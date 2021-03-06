'use strict';
const config = require('config-lite');
const fs = require("fs");
const path = require('path');
const schedule = require('node-schedule');
const dtime = require('time-formater');
const DB = require('../../../models/models');
const WebsiteRx = require('../../website_rx.js');
const WebsiteTx = require('../../website_tx.js');

class BacktestHandle {
    constructor(){
        //绑定，this
        this.task_list = this.task_list.bind(this);
        this.task_list_length = this.task_list_length.bind(this);
        this.add = this.add.bind(this);
        this.del = this.del.bind(this);

    }


    async task_list(req, res, next){
        console.log('[website] backtest task list');
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

        //普通用户进行过滤
        if(req.session.user_type == '1' || req.session.user_type == '0'){
            filter['user_account'] = req.session.user_account;
        }

        //console.log('sort ', sort);
        //console.log('filter ', filter);
        var total = await DB.BacktestTaskTable.count(filter).exec();

        //参数有效性检查
        if(typeof(page_size)==="undefined" && typeof(current_page)==="undefined"){
            var queryList = await DB.BacktestTaskTable.find(filter).sort(sort);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
        }
        else if (page_size > 0 && current_page > 0) {
            var skipnum = (current_page - 1) * page_size;   //跳过数
            var queryList = await DB.BacktestTaskTable.find(filter).sort(sort).skip(skipnum).limit(page_size);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
        }
        else{
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
        }

        console.log('[website] backtest task list end');
    }

    async task_list_length(req, res, next){
        console.log('[website] backtest task_list_length');

        var filter = req.body['filter'];

        // 如果没有定义排序规则，添加默认排序
        if(typeof(filter)==="undefined"){
            //console.log('filter undefined');
            filter = {};
        }

        var query = await DB.BacktestTaskTable.count(filter).exec();
        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:query});

        console.log('[website] backtest task_list_length end');
    }


    async add(req, res, next) {
        console.log('[website] backtest task add');

        //获取表单数据，josn
        var user_account = req.body['user_account'];   //
        var strategy_type = req.body['strategy_type'];
        var strategy_list = req.body['strategy_list'];        //获取表单数据，josn
        var task_id = DB.guid();
        var mytime = new Date();
        var start_time = req.body['start_time'];        //获取表单数据，josn
        var end_time = req.body['end_time'];        //获取表单数据，josn

        // 如果没有定义用户，添加session中的用户
        if(typeof(user_account)==="undefined"){
            user_account = req.session.user_account;
        }

        //更新到设备数据库， 交易的标的不能够重复, index=0 是主策略
        var wherestr = {'trade_symbol': strategy_list[0]['stock_symbol']};

        //参数检查
        var query = await DB.BacktestTaskTable.findOne(wherestr).exec();
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
                'user_account': user_account,   //

                //输入
                'trade_symbol': strategy_list[i]['stock_symbol'],   ///index=0的使用交易symbol
                'trade_ktype': strategy_list[i]['stock_ktype'],   ///index=0的使用交易symbol
                'symbol_name': strategy_list[i]['stock_name'],   ///index=0的使用交易symbol


                //过程
                'strategy_type': strategy_type,   //策略类型
                'strategy_name': strategy_list[i]['strategy_name'],   //策略名称
                'start_time': dtime(start_time).format('YYYY-MM-DD'),   //开始时间
                'end_time': dtime(end_time).format('YYYY-MM-DD'),   //开始时间

                'create_at': dtime(mytime).format('YYYY-MM-DD HH:mm:ss'),
                'sort_time': mytime.getTime()
            };

            var task_item = await DB.BacktestTaskTable.create(updatestr);
            if (task_item == null) {
                res.send({ret_code: -1, ret_msg: 'FAILED', extra: '任务添加数据库失败'});
                return;
            }

            //console.log('strategy_list:', strategy_list);
            message.push(updatestr);
        }

        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:task_id});
        console.log('[website] backtest task add end');
        /*
        //发送任务
        WebsiteTx.send(message, 'backtest.task', 'add', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('add task, response', response);
            if (response['ret_code'] == 0) {
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:task_id});
                console.log('[website] backtest task add end');
            }
            else{
                console.log('worker return error:', response['extra']);
                res.send(response);
                var wherestr = {'task_id': task_id};
                await DB.BacktestTaskTable.remove(wherestr).exec();
            }
        }, 3000);
        */
    }


    async del(req, res, next) {
        console.log('[website] backtest task del');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        console.log('task_id:', task_id);
        var wherestr = {'task_id': task_id};
        var queryList = await DB.BacktestTaskTable.find(wherestr).exec();

        //发送任务,worker 删除任务
        WebsiteTx.send(queryList, 'backtest.task', 'del', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('del task, response', response);
            if (response['ret_code'] == 0) {
                await DB.BacktestTaskTable.remove(wherestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] backtest task del end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }



    async start(req, res, next) {
        console.log('[website] backtest task start');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        //更新到设备数据库， 已经完成的任务不重新开始
        //var wherestr = {'task_id': task_id, 'task_status': 'stop'};
        var wherestr = {'task_id': task_id};
        var queryList = await DB.BacktestTaskTable.find(wherestr).exec();
        if (queryList.length == 0){
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
            return;
        }

        await DB.BacktestResultTable.remove(wherestr).exec();
        WebsiteTx.send(queryList, 'backtest.task', 'add', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('start task, response', response);
            if (response['ret_code'] == 0) {
                var updatestr = {'task_status': 'running'};
                await DB.BacktestTaskTable.update(wherestr, updatestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] backtest task start end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }


    async stop(req, res, next) {
        console.log('[website] backtest task stop');

        //获取表单数据，josn
        var task_id = req.body['task_id'];        //获取表单数据，josn

        //参数有效性检查
        if(typeof(task_id)==="undefined" ){
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
            return;
        }

        //更新到设备数据库， stop
        //var wherestr = {'task_id': task_id, 'task_status': 'running'};
        var wherestr = {'task_id': task_id};
        var queryList = await DB.BacktestTaskTable.find(wherestr).exec();
        if (queryList.length == 0){
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
            return;
        }

        WebsiteTx.send(queryList, 'backtest.task', 'del', ['worker', 'gateway']);
        WebsiteRx.addOnceListener(task_id, async function(type, action, response) {
            //console.log('stop task, response', response);
            if (response['ret_code'] == 0) {
                var updatestr = {'task_status': 'stop'};
                await DB.BacktestTaskTable.update(wherestr, updatestr).exec();
                res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: task_id});
                console.log('[website] backtest task stop end');
            }
            else{
                console.log('error:', response['extra']);
                res.send(response);
            }
        }, 3000);
    }


    async result_list(req, res, next){
        console.log('[website] backtest result list');
        //console.log(req.body);

        //获取表单数据，josn
        var page_size = req.body['page_size'];
        var current_page = req.body['current_page'];
        var sort = req.body['sort'];
        var filter = req.body['filter'];

        // 如果没有定义排序规则，添加默认排序
        if(typeof(sort)==="undefined"){
            sort = {"sort_time":1};
        }

        // 如果没有定义排序规则，添加默认排序
        if(typeof(filter)==="undefined"){
            filter = {};
        }

        //console.log('sort ', sort);
        console.log('filter ', filter);
        var total = await DB.BacktestResultTable.count(filter).exec();

        //参数有效性检查
        if(typeof(page_size)==="undefined" && typeof(current_page)==="undefined"){
            var queryList = await DB.BacktestResultTable.find(filter).sort(sort);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
            //console.log(queryList);
        }
        else if (page_size > 0 && current_page > 0) {
            var skipnum = (current_page - 1) * page_size;   //跳过数
            var queryList = await DB.BacktestResultTable.find(filter).sort(sort).skip(skipnum).limit(page_size);
            res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:queryList, total:total});
        }
        else{
            res.send({ret_code: 1002, ret_msg: 'FAILED', extra:'josn para invalid'});
        }

        console.log('[website] backtest result list end');
    }


    async result_list_length(req, res, next){
        console.log('[website] backtest result_list_length');

        var filter = req.body['filter'];

        // 如果没有定义排序规则，添加默认排序
        if(typeof(filter)==="undefined"){
            //console.log('filter undefined');
            filter = {};
        }
        var query = await DB.BacktestResultTable.count(filter).exec();
        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra:query});

        console.log('[website] backtest result_list_length end');
    }

    async task_status(req, res, next){
        console.log('[website] backtest task_status');
        //console.log(req.body);

        //获取表单数据，josn
        var task_id = req.body['task_id'];

        //更新到设备数据库， stop
        //var wherestr = {'task_id': task_id, 'task_status': 'running'};
        var wherestr = {'task_id': task_id};
        var queryList = await DB.BacktestTaskTable.find(wherestr).exec();
        res.send({ret_code: 0, ret_msg: 'SUCCESS', extra: queryList});
        console.log('[website] backtest task_status end');
    }

    async task_recovey(){
        console.log('[website] backtest task recovery');

        //遍历数据库，恢复运行的任务
        var wherestr = {'task_status': 'running'};
        var queryList = await DB.BacktestTaskTable.find(wherestr).exec();
        WebsiteTx.send(queryList, 'backtest.task', 'add', ['worker', 'gateway']);

        console.log('[website] backtest task recovery end');

    }

}

module.exports = new BacktestHandle()



//await DB.BacktestTaskTable.findOneAndUpdate(wherestr, updatestr).exec();
//await 可以不调用.exec() 返回值
//如果没有转await 则必须调用.exec() 才能返回查询结果,不能通过返回值判断
//如果采用返回值得形式，必须的await

