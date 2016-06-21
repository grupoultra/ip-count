"use strict";
var config = require('./config.json');
var _ = require('lodash');
var ipLib = require('ip');
var amazon_ranges = require('./amazon-ranges.json');
var cloudflare_ranges = require('./cloudflare_ranges.json');

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

    var params = {};

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
        var IPToRegister = getString(processIpList(event.ip));
        console.log(IPToRegister);

        params = {
            TableName: tableName,
            Item: {
                "ip": IPToRegister,
                "datetime": datetime.toISOString()
            }
        };

        dynamoPUT(params)
            .then(function (data) {
                console.log(data);
                return SESsendEmail(IPToRegister);
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

var processIpList = function(ipList){
    var n_1 = getN_1(ipList);
    var publics = getPublicsOnly(n_1);

    var nonAmazon = getNonAmazon(publics);

    return nonAmazon;
};

var getN_1 = function(input){
    var input_wo_spaces = input.replace(/\s+/g, '');
    var input_prev_colon = input_wo_spaces.split(':')[0];
    var input_sep_comma = input_prev_colon.split(',');
    var input_n_1 = input_sep_comma.reverse().slice(1);

    return input_n_1.reverse();
};

var getPublicsOnly = function(ipsArray){
    return _.filter(ipsArray, function(ip){
        return !ipLib.isPrivate(ip);
    })
};

var getNonAmazon = function(ipsArray){
    return _.filter(ipsArray, function(ip){
        return !checkBelongsToAmazon(ip);
    });
};

var checkBelongsToAmazon = function(ip) {
    var amazon_ranges = getAmazonRanges();
    var result = false;

    _.forEach(amazon_ranges, function(range){
        if(ipLib.cidrSubnet(range).contains(ip)){
            result = true;

            return false;
        }
    });

    return result;
};

var getAmazonRanges = function(){
    var cloudfront_prefixes = _.filter(amazon_ranges.prefixes, function(item){
        return item.service === 'CLOUDFRONT' ;
    });

    var cloudfront_ranges = _.map(cloudfront_prefixes, function(prefix_info){
        return prefix_info.ip_prefix;
    });

    return _.concat(cloudfront_ranges, cloudflare_ranges.ranges);
};

var getString = function(ipsArray){
    return ipsArray.join(', ');
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