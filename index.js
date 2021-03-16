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
                    // Web based OAuth 2.0 with Salesforce upon Install
                    const salesforce_url = `https://login.salesforce.com/services/oauth2/authorize?client_id=${process.env.SALESFORCE_CLIENT_ID}&redirect_uri=${process.env.SALESFORCE_REDIRECT_URL}&response_type=code`;
                    res.redirect(salesforce_url);
                } catch (error) {
                    throw error;
                }
            },
            failure: (error, installOptions, req, res) => {
                // Do custom failure logic here
                res.send('failure');
            }
        }
    }
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
        `Select Id, Name, Phone, Email, Profile.Name FROM User WHERE ID=${userId}`
    );

    await say({
        blocks: [
            {
                type: 'section',
                fields: [
                    {
                        type: 'Name',
                        text: '*Name*'
                    },
                    {
                        type: 'mrkdwn',
                        text: '*Email*'
                    },
                    {
                        type: 'mrkdwn',
                        text: '*Profile*'
                    },
                    {
                        type: 'mrkdwn',
                        text: 'Phone'
                    },
                    {
                        type: 'plain_text',
                        text: result.records[0].Name
                    },
                    {
                        type: 'plain_text',
                        text: result.records[0].Email
                    },
                    {
                        type: 'plain_text',
                        text: result.records[0].Profile.Name
                    },
                    {
                        type: 'plain_text',
                        text: result.records[0].Profile.Phone
                    }
                ]
            }
        ]
    });
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
