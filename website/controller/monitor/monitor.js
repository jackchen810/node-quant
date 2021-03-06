'use strict';
const DB = require('../../../models/models.js');
const WebsiteRx = require('../../website_rx.js');
const WebsiteTx = require('../../website_tx.js');
const dtime = require('time-formater');
const fs = require("fs");
const path = require('path');


class MonitorHandle {
    constructor(){
        this.list = this.list.bind(this);
        this.add = this.add.bind(this);
        this.del = this.del.bind(this);
        //console.log('TaskHandle constructor');
    }


    async list(req, res, next){
        console.log('task list');
        //console.log(req.body);

        //获取表单数据，josn
        var page_size = req.body['page_size'];
        var current_page = req.body['current_page'];
        var sort = req.body['sort'];
        var filter = req.body['filter'];

        // 如果没有定义排序规则，添加默认排序
        if(typeof(sort)==="undefined"){
            //console.log('sort undefined');
            sort = {"sort_time":-1};
        }

        // 如果没有定义排序规则，添加默认排序
        if(typeof(filter)==="undefined"){
            //console.log('filter undefined');
            filter = {};
        }

        //添加过滤条件
        filter['task_type'] = 'trade';

        //参数有效性检查
        if(typeof(page_size)==="undefined" && typeof(current_page)==="undefined"){
            var queryList = await DB.TaskTable.find(filter).sort(sort);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList});
        }
        else if (page_size > 0 && current_page > 0) {
            var skipnum = (current_page - 1) * page_size;   //跳过数
            var queryList = await DB.TaskTable.find(filter).sort(sort).skip(skipnum).limit(page_size);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList});
        }
        else{
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
        }

        console.log('task list end');
    }



    async add(req, res, next) {
        console.log('[website] monitor task add');

        //获取表单数据，josn
        var strategy_type = req.body['strategy_type'];
        var strategy_list = req.body['strategy_list'];        //获取表单数据，josn
        var riskctrl_name = req.body['riskctrl_name'];        //获取表单数据，josn
        var market_gateway = req.body['market_gateway'];
        var order_gateway = req.body['order_gateway'];
        var task_id =  DB.guid();
        var mytime = new Date();


        //更新到设备数据库， 交易的标的不能够重复, index=0 是主策略
        var wherestr = {'task_type': 'trade', 'trade_symbol': strategy_list[0]['stock_symbol']};

        //参数检查
        var query = await DB.TaskTable.findOne(wherestr).exec();
        if (query != null) {
            res.send({ret_code: -1, ret_msg: 'FAILED', extra:'任务重复'});
            return;
        }

        var message = [];
        for(var i = 0; i< strategy_list.length; i++) {

            var updatestr = {
                'task_id': task_id,
                'task_type': (i==0 ? 'trade':'order_point'),  //任务结果
                'task_status': 'stop',   // 运行状态

                //输入
                'trade_symbol': strategy_list[i]['stock_symbol'],   ///index=0的使用交易symbol
                'trade_ktype': strategy_list[i]['stock_ktype'],   ///index=0的使用交易symbol
                'symbol_name': strategy_list[i]['stock_name'],   ///index=0的使用交易symbol


                //过程
                'strategy_type': strategy_type,   //策略类型
                'strategy_name': strategy_list[i]['strategy_name'],   //策略名称
                'riskctrl_name': (i==0 ? riskctrl_name: ''),   //风控名称
                'market_gateway': (i==0 ? market_gateway: ''),   //交易网关名称
                'order_gateway': (i==0 ? order_gateway: ''),   //交易网关名称

                'create_at': dtime(mytime).format('YYYY-MM-DD HH:mm:ss'),
                'sort_time': mytime.getTime()
            };

            var task_item = await DB.TaskTable.create(updatestr);
            if (task_item == null) {
                res.send({ret_code: -1, ret_msg: 'FAILED', extra: '任务添加数据库失败'});
                return;
            }

            console.log('strategy_list:', strategy_list);
            message.push(updatestr);
        }

        //发送任务
        WebsiteTx.send(message, 'trade.task', 'add', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('add task, response', response);
            if (response['ret_code'] == 0) {
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:task_id});
                console.log('[website] monitor task add end');
            }
            else{
                console.log('worker return error:', response['extra']);
                res.send(response);
                var wherestr = {'task_id': task_id};
                await DB.TaskTable.remove(wherestr).exec();
            }
        }, 3000);
    }


    async del(req, res, next) {
        console.log('[website] monitor task del');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        console.log('task_id:', task_id);
        var wherestr = {'task_id': task_id};
        var queryList = await DB.TaskTable.find(wherestr).exec();

        //发送任务,worker 删除任务
        WebsiteTx.send(queryList, 'trade.task', 'del', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('del task, response', response);
            if (response['ret_code'] == 0) {
                await DB.TaskTable.remove(wherestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] monitor task del end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }

    async start(req, res, next) {
        console.log('[website] monitor task start');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        //更新到设备数据库， 设备上线，下线
        var wherestr = {'task_id': task_id};
        var queryList = await DB.TaskTable.find(wherestr).exec();

        WebsiteTx.send(queryList, 'trade.task', 'add', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('start task, response', response);
            if (response['ret_code'] == 0) {
                var updatestr = {'task_status': 'running'};
                await DB.TaskTable.update(wherestr, updatestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] monitor task start end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }


    async stop(req, res, next) {
        console.log('[website] monitor task stop');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        //更新到设备数据库， stop
        var wherestr = {'task_id': task_id};
        var queryList = await DB.TaskTable.find(wherestr).exec();

        WebsiteTx.send(queryList, 'trade.task', 'del', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('stop task, response', response);
            if (response['ret_code'] == 0) {
                var updatestr = {'task_status': 'stop'};
                await DB.TaskTable.update(wherestr, updatestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] monitor task stop end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }

}

module.exports = new MonitorHandle()



//await DB.TaskTable.findOneAndUpdate(wherestr, updatestr).exec();
//await 可以不调用.exec() 返回值
//如果没有转await 则必须调用.exec() 才能返回查询结果,不能通过返回值判断
//如果采用返回值得形式，必须的await

