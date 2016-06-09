"use strict";


var config = require('./config.json');

var aws = require('aws-sdk');
aws.config.update({
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
});
aws.config.setPromisesDependency(require('q').Promise);
var ses = new aws.SES({apiVersion: '2010-12-01'});

var docClient = new aws.DynamoDB.DocumentClient();



var express = require('express');
var app = express();

app.get('/', function( req, res ) {
    console.log(req.query.ip);


    var tableName = "ip-count";
    var params = {
        TableName : tableName,
        ProjectionExpression  : "ip, ccount",
        FilterExpression: "ip = :ip",
        ExpressionAttributeValues  : {":ip": req.query.ip}
    };

    dynamoSCAN(params)
        .then(function(data){
            var ips = data.Items;
            var count = 1;
            console.log("data", data);
            console.log("ips", ips);
            if(ips.length > 0) {
                count = ips[0]['ccount'] + 1;
            }

            return count;
        })
        .then(function(count) {
            return {
                TableName: tableName,
                Item: {
                    "ip": req.query.ip,
                    "ccount": count
                }
            }
        })
        .then(function(params){
            console.log(params);
            return dynamoPUT(params)
        })
        .then(function(data) {
            console.log(data);
            res.send("bien");
        })
        .catch(function(err){
            console.log("error: ", err.errorMessage[0]);
            res.send(err);
        });
});

app.listen(8080, function () {
    console.log('Example app listening on port 3000!');
});


// var handler =

var encrypt = function (myPlaintextPassword) {
    var saltRounds = 10;
    return bcrypt.hash(myPlaintextPassword, saltRounds);
};

var dynamoSCAN = function(params) {
    return docClient.scan(params).promise();
};

var dynamoPUT = function(params){
    return docClient.put(params).promise();
};

var dynamoUPDATE = function(params){
    return docClient.update(params).promise();
};