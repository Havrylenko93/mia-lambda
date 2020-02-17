exports.handler = function(event) {
    let jsforce = require('jsforce');
    let conn = new jsforce.Connection({loginUrl : 'https://login.salesforce.com'});

    event.Records.forEach(record => {
        const { body } = record;
        let fields = JSON.parse(body);

        conn.login(process.env.userLogin, process.env.userPassword + process.env.userSecurityToken, function(err, userInfo) {
            if (err) {
                throw Error('Salesforce login error');
            }

            conn.query("SELECT l.Id FROM Lead AS l WHERE Email='"+ fields.Email +"' LIMIT 1", function(err, result) {

                if (err) {
                    return console.error('Cant find LEAD by user email', err);
                }

                let leadId = result.records[0].Id;

                let obj = {
                    Id : leadId,
                };
                delete fields.userEmail;
                if (fields.body_pics) {
                    delete fields.body_pics;

                }

                let dataForSalesforce = {...obj, ...fields};

                conn.sobject("Lead").update(dataForSalesforce, function(err, ret) {
                    if (err || !ret.success) {
                        console.log('ALARM: ', err);
                        throw Error('Salesforce LEAD updating error', dataForSalesforce);
                    }
                });
            });
        });
    });
};
