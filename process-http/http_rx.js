'use strict';
const config = require("config-lite");
const fs = require("fs");
const path = require("path");
const db = require('../mongodb/db.js');
const  HttpTx = require("./http_tx");
const events = require("events");
//创建事件监听的一个对象
const  emitter = new events.EventEmitter();

/*
* request 格式：{'head': {'type': this.type, 'action': this.action}, body:message}
* response 格式：{'head': {'type': this.type, 'action': this.action}, body:message}
* */

class HttpRx{
    constructor(){
        //记录任务id
        this.type = null;
        this.action = null;
        this.head = null;

        //bind
        //this.send = this.send.bind(this);
        this.addLoopListener = this.addLoopListener.bind(this);
        this.onMessage = this.onMessage.bind(this);

        //console.log('HttpRx process on');

        //监听进程消息
        process.on('message', this.onMessage);
    }


    //onMessage  ----数据接收
    async onMessage(msg) {
        if (typeof msg != 'object'){
            console.log('[http entry] msg is error');
            var response = {ret_code: 1002, ret_msg: 'FAILED', extra:'type error'};
            HttpTx.send(response);
            return;
        }

        console.log('[onMessage][http] recv request:', JSON.stringify(msg));
        //tradeLog('system', '1', msg);

        //type, action, data
        var head = msg['head'];
        var body = msg['body'];
        this.head = head;

        var type = head['type'];
        var action = head['action'];
        emitter.emit(type, action, body);
        if (type == 'market' || type == 'backtest' || type == 'trade' || type == 'download') {
            emitter.emit(body['extra'], type, action, body);
        }
    }


    //监听事件some_event
    // 仅适用于但命令任务下发，不适用于批量任务
    async addLoopListener (event, listener_callback){

        //监听事件some_event
        await emitter.on(event, listener_callback);
    }


    //监听事件some_event
    // 仅适用于但命令任务下发，不适用于批量任务
    async addOnceListener(event, listener_callback, timeout){

        //监听事件some_event
        await emitter.once(event, listener_callback);

        setTimeout(function(){
            //task_id,---- type, action, response
            var response = {ret_code: -1, ret_msg: 'FAILED', extra: 'timeout'};
            emitter.emit(event, '-1', '-1', response);
        }, timeout);
    }
}

module.exports = new HttpRx();

/*
//监听事件some_event
// 仅适用于但命令任务下发，不适用于批量任务
HttpRx.addLoopListener = function (event, listener_callback){

    //监听事件some_event
    emitter.on(event, listener_callback);
}


//监听事件some_event
// 仅适用于但命令任务下发，不适用于批量任务
HttpRx.addOnceListener = function (event, listener_callback, timeout){

    //监听事件some_event
    emitter.once(event, listener_callback);

    setTimeout(function(){
        //task_id,---- type, action, response
        var response = {ret_code: -1, ret_msg: 'FAILED', extra: 'timeout'};
        emitter.emit(event, '-1', '-1', response);
    }, timeout);
}

// 增加类方法，不需要实例直接调用
HttpRx.process_send = function (type, action, message, dest){

    if(typeof(type)==="undefined"
        || typeof(action)==="undefined"
        || typeof(message)==="undefined"
        || typeof(dest)==="undefined"){
        throw new Error('para undefined');
        return;
    }

    var res = {
        'head': {'type': type, 'action': action, 'source': 'process-http', 'dest': dest},
        'body': message,
    }
    //console.log('[process-http] send:', JSON.stringify(res));
    console.log('process-http---> %s', dest);
    process.send(res);
    return;
}
*/

//const response = new HttpRx();


/*
process.on('message', function(msg) {
    if (typeof msg != 'object'){
        console.log('msg is error');
        var response = new HttpRx('system', 'error');
        response.send({ret_code: 1002, ret_msg: 'FAILED', extra:'type error'});
        return;
    }

    console.log('[http entry] recv request:', JSON.stringify(msg));
    //tradeLog('system', '1', msg);

    //type, action, data
    var head = msg['head'];
    var body = msg['body'];

    var type = head['type'];
    var action = head['action'];
    emitter.emit(type, action, body);
    if (type == 'task') {
        emitter.emit(body['extra']['task_id'], type, action, body);
    }

});
*/
