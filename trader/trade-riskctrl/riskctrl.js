'use strict';
const BaseRiskctrl = require("../../prototype/riskctrlBaseClass");

//策略要继承基类
class RisckctrlClass extends BaseRiskctrl {
    constructor(){
        super();
        console.log('constructor');
    }

    //这个是 on_buy 事件的回调函数
    async on_buy(ktype, msgObj){
        console.log('RisckctrlClass, on_buy:', this.task_id);
        console.log('RisckctrlClass, on_buy:', msgObj);

        var buyObj = {
            'symbol': msgObj['symbol'],
            'ktype': msgObj['ktype'],
            'price': '12.8',
            'volume': '24',
        }

        //this.toBuy(buyObj);
        return;
    }

}
console.log('create worker RisckctrlClass');

//导出模块
module.exports = new RisckctrlClass();

