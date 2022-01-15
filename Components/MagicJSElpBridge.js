/*
Magic JS PHPセッション取得部
 */
const phpSerializer = require('php-serialize');
const redis = require('redis');
const bluebird = require('bluebird');
const SystemSettings = require('../../Settings/SysEnv.json');

bluebird.promisifyAll(redis.RedisClient.prototype);

const client = redis.createClient({
    host: SystemSettings.RedisHost,
    port: SystemSettings.RedisPort,
    enable_offline_queue: false,
    retry_strategy: (options) => {
        console.log(options);
        return 5000;
    }
});

exports.session = function(req, res, next) {
    if (!req.cookies) {
        console.error('must use cookie-parser middleware');
        return next();
    }

    const sessionId = req.cookies['PHPSESSID'];
    if (!sessionId) {
        return next();
    }

    const sessionKey = 'PHPREDIS_SESSION:' + sessionId;
    client.getAsync(sessionKey).then((sessionStr) => {
        if (sessionStr) {
            req.session = new Session(sessionKey, sessionStr);
        }
        return next();
    }).catch((err) => {
        return next(new Error('Server error'));
    });
}

function Session(sessionId, sessionStr) {
    this.id = sessionId;
    let data;
    try {
        data = phpSerializer.unserialize(sessionStr);
    } catch(e) {
        return;
    }

    for (const prop in data) {
        if (!(prop in this)) {
            this[prop] = data[prop];
        }
    }
}