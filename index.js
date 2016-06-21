"use strict";
var config = require('./config.json');
var _ = require('lodash');

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
    var datetime = new Date();
    var tableName = "ip-count";

    var params = {
        TableName: tableName,
        Item: {
            "ip": event.ip,
            "datetime": datetime.toISOString()
        }
    };

    if(event.getIps){
        params = { TableName: tableName };

        dynamoSCAN(params)
            .then(function(data){
                var ip_count = {};
                console.log(data);
                _.forEach(_.groupBy(data.Items, 'ip'), function(value, key) {
                    ip_count[key] = value.length;
                });

                console.log(ip_count);
                context.done(null, ip_count);
            });

    } else {
        dynamoPUT(params)
            .then(function (data) {
                console.log(data);
                return SESsendEmail(event.ip);
            })
            .then(function (data) {
                console.log(data);
                context.done(null, data);
            })
            .catch(function (err) {
                console.log("error: ", err.errorMessage[0]);
                context.done(err);
            });
    }
};

var SESsendEmail = function(ip){
    console.log("ip registrada", ip);

    var content =
        "<p>El IP <b>" + ip + "</b> ha sido incluido en la lista de posibles ofensores porque rompió el umbral de 100 "
        + "hits/seg. No se ha tomado ninguna acción al respecto (ej. no se ha bloqueado)</p>"
        + "<p> Timestamp: "+ new Date() +"</p>"
        + "<p>-------------------------------</p>"
        + "<p>Soporte</p>"
        + "<p>" + config.senderAddress + "</p>"
        + "<p>Grupo ULTRA</p>"
        + "<p>-------------------------------</p>";
    var subject = "Nueva IP registrada en Xpander: " + ip;
    return ses.sendEmail({
        Source: config.senderAddress,
        // Destination: { ToAddresses: [ config.senderAddress ] },
        Destination: { ToAddresses: [ "jhounny.nunez@ultra.sur.top", "cesar.obach@ultra.sur.top" ] },
        // Destination: { ToAddresses: [ config.senderAddress, "jhounny.nunez@ultra.sur.top", "cesar.obach@ultra.sur.top" ] },
        Message: {
            Subject: {
                Data: subject
            },
            Body: {
                Html: {
                    Data: content
                }
            }
        }
    }).promise()
};

var dynamoSCAN = function(params) {
    return docClient.scan(params).promise();
};

var dynamoPUT = function(params){
    return docClient.put(params).promise();
};