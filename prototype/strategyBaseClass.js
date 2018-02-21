'use strict';

module.exports = class BaseStrategy {
    constructor(){
        //记录任务id
        this.task_id = '';
        this.emitter = '';
        this.symbol = '';
        this.ktype = '';
        this.main_strategy = false;

        //绑定，this
        this.on_tick = this.on_tick.bind(this);
        this.on_bar = this.on_bar.bind(this);
        this.on_buy_point = this.on_buy_point.bind(this);
        this.on_sell_point = this.on_sell_point.bind(this);


    }

    //onInit  ----不需要用户修改
    async onInit(emitter, task_id, symbol, ktype){
        this.task_id = task_id;
        this.emitter = emitter;
        this.symbol = symbol;
        this.ktype = ktype;

        //监听事件some_event，  主策略产生的 买卖事件
        this.emitter.on('on_tick', this.on_tick);
        this.emitter.on('on_bar', this.on_bar);
        this.emitter.on('on_buy_point', this.on_buy_point);
        this.emitter.on('on_sell_point', this.on_sell_point);
        //console.log('111111', ktype);
        return;
    }

    //onInitMainStrategy  初始化化主策略
    async onInitMainStrategy(symbol){
        if (symbol == this.symbol){
            this.main_strategy = true;
        }
        return;
    }


    //on_tick 收到tick行情数据时回调
    async on_tick(msgObj){
        throw new Error('strategy on_tick 需要用户实现');
        return;
    }

    //on_bar   收到分钟线数据的时回调
    async on_bar(ktype, msgObj){
        throw new Error('strategy on_bar 需要用户实现');
        return;
    }

    //on_buy_point   收到买点事回调
    async on_buy_point(ktype, msgObj){
        throw new Error('strategy on_buy_point 需要用户实现');
        return;
    }

    //on_sell_point   收到卖点事回调
    async on_sell_point(ktype, msgObj){
        throw new Error('strategy on_sell_point 需要用户实现');
        return;
    }



    //to_buy  发送买单
    async to_buy(ktype, msgObj){
        console.log('to_buy');
        //1. 发送event:on_buy 事件， riskctrl使用
        if (this.main_strategy) {
            this.emitter.emit('on_buy', ktype, msgObj);
        }
        else {
            this.emitter.emit('on_buy_point', ktype, msgObj);
        }
        return;
    }

    //to_sell  发送卖单
    async to_sell(ktype, msgObj){
        console.log('to_sell');
        //1. 发送event:on_sell 事件， riskctrl使用
        if (this.main_strategy) {
            this.emitter.emit('on_sell', ktype, msgObj);
        }
        else {
            this.emitter.emit('on_sell_point', ktype, msgObj);
        }
        return;
    }
}


