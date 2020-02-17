const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const axios = require('axios');
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const convert = require('heic-convert');

function generateRandomString(length) {
    const charactersSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randoms = [];

    for (let i = 0; i < length; i++) {
        randoms.push(charactersSet[Math.floor(Math.random() * charactersSet.length)]);
    }
    return randoms.join('');
}

exports.handler = async function (event) {

    let buff = Buffer.from(event['body-json'].toString(), 'base64');
    let requestBody = JSON.parse(buff.toString('utf-8'));
    let today = new Date();
    let day = String(today.getDate()).padStart(2, '0');
    let month = String(today.getMonth() + 1).padStart(2, '0');
    let year = today.getFullYear();
    let $dataObject = {};

    for (let curr in requestBody) {
        if (requestBody[curr] == '') {
            continue;
        }

        if (curr == 'Date_of_Birth__c' || curr == 'Previous_Procedure_Date__c') {
            let dateArray = requestBody[curr].split("-");
            requestBody[curr] = dateArray.join('-');
        }

        if ((curr == 'Right_Side_Pic__c' || curr == 'Front_Pic__c' || curr == 'Back_Pic__c' || curr == 'Left_Side_Pic__c') && (requestBody['body_pics'] == 'Yes')) {
            let array = requestBody[curr].split(".");
            let imageExt = array[array.length - 1];
            let image = await axios.get(requestBody[curr], {responseType: 'arraybuffer'});
            let returnedB64 = Buffer.from(image.data).toString('base64');
            let finalData = 'data:image/' + imageExt + ';base64,' + returnedB64;
            let imageContentType = 'image/' + imageExt;

            let buffer = Buffer.from(finalData.replace(/^data:image\/\w+;base64,/, ""), 'base64');

            let fileName = generateRandomString(50) + '.' + imageExt;
            let fileFullPath = year + '/' + month + '/' + day + '/' + fileName;

            if (imageExt == 'heic' || imageExt == 'HEIC') {
                const outputBuffer = await convert({
                    buffer: buffer,
                    format: 'JPEG',
                    quality: 1
                });
                buffer = outputBuffer;
                fileName = generateRandomString(50) + '.jpg';
                fileFullPath = year + '/' + month + '/' + day + '/' + fileName;
                imageContentType = 'image/jpg';
            }

            s3.putObject({
                Body: buffer,
                Bucket: process.env.bucketName,
                ContentType: imageContentType,
                ACL: 'public-read',
                Key: fileFullPath
            }).promise();

            let publicImageUrl = process.env.backendEndpoint + fileFullPath;

            $dataObject[curr] = publicImageUrl;
        } else {
            $dataObject[curr] = requestBody[curr];
        }
    }

    let sqsBody = {
        MessageBody: JSON.stringify($dataObject),
        QueueUrl: 'https://sqs.us-east-2.amazonaws.com/258456434857/mia-typeform'
    };
    sqs.sendMessage(sqsBody, function (err, data) {
        if (err) {
            console.log('ALARM! Error while sending data to SQS');
        }
    });

    let image = await axios.get('https://i.ytimg.com/vi/XoghLNfGOao/maxresdefault.jpg', {responseType: 'arraybuffer'});
    let returnedB64 = Buffer.from(image.data).toString('base64');
    let finalData = 'data:image/' + 'jpg' + ';base64,' + returnedB64;

    const buffer = Buffer.from(finalData.replace(/^data:image\/\w+;base64,/, ""), 'base64');

    let fileName = generateRandomString(50) + '.' + 'jpg';
    let fileFullPath = year + '/' + month + '/' + day + '/' + fileName;
};
