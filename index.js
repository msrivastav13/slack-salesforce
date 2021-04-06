const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const jsforce = require('jsforce'); //jsforce open source library to connect to Salesforce

// Create Salesforce Connection
const oauth2 = new jsforce.OAuth2({
    // you can change loginUrl to connect to sandbox or prerelease env.
    // loginUrl : 'https://test.salesforce.com',
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    redirectUri: process.env.SALESFORCE_REDIRECT_URL
});
const connection = new jsforce.Connection({ oauth2: oauth2 });

// Create a Reciever for Installation and OAuth with Slack and Salesforce
const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    stateSecret: process.env.STATE_SECRET,
    scopes: [
        'channels:read',
        'groups:read',
        'channels:manage',
        'chat:write',
        'incoming-webhook',
        'commands'
    ],
    endpoints: {
        events: '/slack/events',
        commands: '/slack/commands' // explicitly enable commands
    },
    installerOptions: {
        authVersion: 'v2', // default  is 'v2', 'v1' is used for classic slack apps
        installPath: '/slack/install',
        redirectUriPath: '/slack/oauth_redirect',
        callbackOptions: {
            success: async (installation, installOptions, req, res) => {
                try {
                    await say({
                        blocks: [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": "To login into Salesforce click the button below"
                                }
                            },
                            {
                                "type": "actions",
                                "elements": [
                                    {
                                        "type": "button",
                                        "text": {
                                            "type": "plain_text",
                                            "text": "Authorize Salesforce"
                                        },
                                        "value": "authsfdc",
                                        "action_id": "authsf"
                                    }
                                ]
                            }
                        ]
                    })
                    res.send('The app is successfully installed! You can close this window!!!!');
                } catch (error) {
                    throw error;
                }
            },
            failure: (error, installOptions, req, res) => {
                // Do custom failure logic here
                res.send('failure');
            }
        }
    },
});

// Instantiate Slack App with Custom Reciever
const app = new App({
    logLevel: LogLevel.DEBUG,
    receiver
});

app.command('/whoami', async ({ command, ack, say }) => {
    // Acknowledge command request
    await ack();
    const userId = connection.userInfo.id;
    const result = await connection.query(
        `Select Id, Name, Phone, Email, Profile.Name FROM User WHERE ID='${userId}'`
    );
    console.log(result);
    try {
        await say({
            blocks: [
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: '*Name*'
                        },
                        {
                            type: 'mrkdwn',
                            text: '*Email*'
                        },
                        {
                            type: 'plain_text',
                            text: `${result.records[0].Name}`
                        },
                        {
                            type: 'plain_text',
                            text: `${result.records[0].Email}`
                        },
                        {
                            type: 'mrkdwn',
                            text: '*Phone*'
                        },
                        {
                            type: 'mrkdwn',
                            text: '*Profile Name*'
                        },
                        {
                            type: 'plain_text',
                            text: `${result.records[0].Phone}`
                        },
                        {
                            type: 'plain_text',
                            text: `${result.records[0].Profile.Name}`
                        }
                    ]
                }
            ]
        });
    } catch (e) {
        console.log(e);
    }
});

receiver.router.get('/salesforce/oauth_redirect', async (req, res) => {
    let code = req.query.code;
    connection.authorize(code, function (err, userInfo) {
        if (err) {
            return console.error(err);
        }
        // Now you can get the access token, refresh token, and instance URL information.
        // Save them to establish connection next time.
        //console.log(conn.accessToken);
        //console.log(conn.refreshToken);
        console.log(connection.instanceUrl);
        console.log('User ID: ' + userInfo.id);
        console.log('Org ID: ' + userInfo.organizationId);
        // ...
        res.send(
            'Successfully connected slack with your Salesforce User. You can close this window'
        ); // or your desired response
    });
});

(async () => {
    // Start your app
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
})();
