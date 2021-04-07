const { App, LogLevel, ExpressReceiver } = require('@slack/bolt');
const jsforce = require('jsforce'); //jsforce open source library to connect to Salesforce

// Create Salesforce Connection
const oauth2 = new jsforce.OAuth2({
    // you can change loginUrl to connect to sandbox or scratchorg env.
    // loginUrl : 'https://test.salesforce.com',
    clientId: process.env.SALESFORCE_CLIENT_ID,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
    redirectUri: process.env.SALESFORCE_REDIRECT_URL
});
const connection = new jsforce.Connection({ oauth2: oauth2 });

// This is hack at this point. This needs to be stored in Database
let oAuthResponseFromSlackInstall = {};

// Create a Reciever for Installation and OAuth with Slack and Salesforce
// One needs ExpressReciever if you want to take complete control of the OAuth 2.0 dance
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
        callbackOptions: {
            success: async (installation, installOptions, req, res) => {
                try {
                    oAuthResponseFromSlackInstall = installation;
                    res.redirect('/slack/appinstall/success');
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
    // TODO Implement a install store to persist the tokens as per the below docs
    // https://slack.dev/bolt-js/concepts#authenticating-oauth
});

// Instantiate Slack App with Custom Reciever
const app = new App({
    logLevel: LogLevel.DEBUG,
    receiver
});

// Command to render button for Salesforce Connection
app.command('/connectsf', async ({ command, ack, say }) => {
    // Acknowledge command request
    await ack();
    const salesforce_url = `https://login.salesforce.com/services/oauth2/authorize?client_id=${process.env.SALESFORCE_CLIENT_ID}&redirect_uri=${process.env.SALESFORCE_REDIRECT_URL}&response_type=code`;
    await say(renderAuthorizeButton(salesforce_url));
});

// Command to Acknowledge when Authorize Button is clicked
app.action('authorize_sf', async ({ command, ack, say }) => {
    await ack();
});

// Command to query Userinfo from Salesforce and display a Block UI
app.command('/whoami', async ({ command, ack, say }) => {
    // Acknowledge command request
    await ack();
    if (connection.userInfo) {
        const userId = connection.userInfo.id;
        const result = await connection.query(
            `Select Id, Name, Phone, Email, Profile.Name FROM User WHERE ID='${userId}'`
        );
        console.log(result);
        try {
            await say(renderWhoamiBlock(result));
        } catch (e) {
            console.log(e);
        }
    } else {
        const salesforce_url = `https://login.salesforce.com/services/oauth2/authorize?client_id=${process.env.SALESFORCE_CLIENT_ID}&redirect_uri=${process.env.SALESFORCE_REDIRECT_URL}&response_type=code`;
        await say(renderAuthorizeButton(salesforce_url));
    }
});

// renders Whoami Block
function renderWhoamiBlock(result) {
    return {
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
    }
}

// Block SDK for returning the Authorize Button
function renderAuthorizeButton(salesforce_url) {
    return {
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: 'To login into Salesforce click the button below'
                }
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'Authorize Salesforce'
                        },
                        style: 'primary',
                        value: 'authsf',
                        url: salesforce_url,
                        action_id: 'authorize_sf'
                    }
                ]
            }
        ]
    };
}

// Upon redirect Authorize Salesforce
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
        res.redirect('/auth/success');
        // or your desired response
    });
});

// Custom Route for success Message
receiver.router.get('/auth/success', async (req, res) => {
    await app.client.chat.postMessage({'channel': oAuthResponseFromSlackInstall.incomingWebhook.channelId, 'text': 'Succcessfully authorized to Salesforce 🎉', token: oAuthResponseFromSlackInstall.bot.token});
    res.send(
        'Successfully connected slack with your Salesforce User. You can close this window'
    );
});

// Custom Route for Install success Message
receiver.router.get('/slack/appinstall/success', async (req, res) => {
    await app.client.chat.postMessage({'channel': oAuthResponseFromSlackInstall.incomingWebhook.channelId, 'text': 'The app is Succcessfully Installed 🎊', token: oAuthResponseFromSlackInstall.bot.token});
    res.send('The app is Successfully installed!!! You can close this window');
});

app.event('app_home_opened', ({ event, say }) => {  
    say(`Slack Salesforce Hello App, <@${event.user}>!`);
});

(async () => {
    // Start your app
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
})();
