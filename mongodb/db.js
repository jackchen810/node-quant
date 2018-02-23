'use strict';

//import mongoose from 'mongoose';
//import config from 'config-lite';
const mongoose = require('mongoose');
const config = require('config-lite');
mongoose.connect(config.url, {useMongoClient:true});
mongoose.Promise = global.Promise;

const db = mongoose.connection;

db.once('open' ,() => {
	console.log('连接数据库成功, pid:', process.pid);
})

db.on('error', function(error) {
    console.error('Error in MongoDb connection: ' + error);
    mongoose.disconnect();
});

db.on('close', function() {
    console.log('数据库断开，重新连接数据库');
    mongoose.connect(config.url, {server:{auto_reconnect:true}});
});

//export default db;
//导出模块
module.exports = db;