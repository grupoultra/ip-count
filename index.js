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

exports.handler = function( event, context ) {
  var tableName = "ip-count";
  var params = {
      TableName : tableName,
      ProjectionExpression  : "ip, ccount",
      FilterExpression: "ip = :ip",
      ExpressionAttributeValues  : {":ip": event.ip}
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
                "ip": event.ip,
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
        context.done(null, data);
    })
    .catch(function(err){
        console.log("error: ", err.errorMessage[0]);
        context.done(err);
    });
};

var dynamoSCAN = function(params) {
    return docClient.scan(params).promise();
};

var dynamoPUT = function(params){
    return docClient.put(params).promise();
};