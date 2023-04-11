const utils = require('utility');
const axios = require('axios').default;
const lodash = require('lodash');
const uuid = require('uuid');
const UserAgents = require('./configs/UserAgents');
const wait = require('timers/promises').setTimeout;
const notify = require('./sendNotify');

const $ = axios.create({
    headers: {
        "Referer": "https://m.jd.com/",
        "User-Agent": UserAgents()
    }
});

class Env {
    name = '';
    fileName = '';
    index = 0;
    envCookies = '';
    cookies = [];
    cookie = '';
    userName = '';
    nickname = '';
    messages = [];
    debugMode = false;
    stopAll = false;

    defaultConfig = {
        delay: [0, 100],
        fileName: '',
        debugMode: false,
    };
    
    constructor(name = '') {
        this.name = name;
    }

    /** 获取Cookie之前调用 */
    async onBefore() {}

    /** 第一个Cookie逻辑执行之前调用（有些逻辑只需要执行一次） */
    async onFirst() {}

    /** 主逻辑（每个cookie都会调用） */
    async onLogic() {}

    /** 脚本运行结束前调用  */
    async onAfter() {}

    /**
     * 开始运行
     */
    async run(config = this.defaultConfig) {
        lodash.defaults(config, this.defaultConfig);

        const start = this.timestampMS();
        console.log(`#####[${this.now()}][${this.name}] 运行开始\n`);

        try {
            this.fileName = config?.fileName;
            this.debugMode = config?.debugMode;
            this.envCookies = process.env.JD_COOKIE; //默认是JD_COOKIE

            await this.onBefore();

            this.cookies = await this.initCookies();

            console.log(`\n###[${this.now()}] 读取到${this.cookies.length}个Cookie`);

            this.index = 0;
            for (let i = 0; i < this.cookies.length; i++) {
                this.index++;
                this.cookie = this.cookies[i];

                $.defaults.headers.common["User-Agent"] = UserAgents();
                $.defaults.headers.common["Cookie"] = this.cookie;
                
                if (!(await this.checkUser())) continue;

                console.log(`\n###[${this.now()}][${this.index}][${this.userName}] 开始运行`);
                this.pushMsg(`\n【${this.index} ${this.userName}】`)

                try {
                    if (i == 0) await this.onFirst();
                    await this.onLogic();
                } catch (error) {
                    console.log(`\n###[${this.now()}][${this.index}][${this.userName}] 执行异常`, error.stack);
                    if (this.stopAll) return;
                }

                if (config.once) break;

                await this.waitRandom(...config.delay);
            }
    
            await this.onAfter();

            await this.sendNotify();
        } catch (error) {
            console.log(this.name, '脚本执行异常', error);
        } finally {
            console.log(`\n#####[${this.now()}][${this.name}] 运行结束，耗时 ${(this.timestampMS() - start) / 1000} s\n`);
        }
    }

    async initCookies() {
        let cookies = [];
        if (!this.envCookies) {
            cookies = await this.initTestCookies();
            if (cookies?.length > 0) return cookies;
            throw new Error('请设置环境变量JD_COOKIE');
        }
        const strCookies = this.envCookies;
        if (strCookies.indexOf("&") > -1) {
            cookies = strCookies.split("&");
        } else if (strCookies.indexOf("\n") > -1) {
            cookies = strCookies.split("\n");
        } else {
            cookies = [strCookies];
        }
        return cookies;
    }

    async initTestCookies() {
        try {
            return await this.readJSON('./datas/testCookies.json');
        } catch (error) {
            return null;
        }
    }

    async checkUser() {
        let pin = decodeURIComponent(this.cookie.match(/pt_pin=([^;\s]*);?/)[1]);
        try {
            const url = `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`;
            const response = await $.post(url);
            const data = response.data;
            // console.log(data);
            if (data.retcode == 13)
            {
                this.pushMsg(`\n[${this.index}][${pin}]登录失效`)
                return false;
            }
            else if (data.retcode != 0) {
                this.logToJson(data);
                return false;
            }
            this.userName = data.base?.nickname || pin;
            return true;
        } catch (error) {
            this.log(error.stack);
            this.userName = pin;
            return true;
        }
    }

    log = console.log;

    logToJson(params) {
        this.log(this.toJson(params));
    }

    pushMsg(...params) {
        let msg = lodash.join(params, ' ');
        this.log(msg);
        this.messages.push(msg);
    }

    /**
     * 在数字的前面补0
     * @param {number|string} num - 数字
     * @param {number} length - 位数
     * @param {number|string} chars - chars
     * @returns {string}
     */
    pad(num, length = 2, chars = 0) {
        return lodash.padStart(num, length, chars);
    }

    async sendNotify() {
        await notify.sendNotify(this.name, this.messages.join("\n"));
    }

    UserAgents = UserAgents;

    toJson = JSON.stringify;

    uuid = uuid.v4;

    has = utils.has;
    random = utils.random;
    randomSlice = utils.randomSlice;
    randomString = utils.randomString;
    readJSON = utils.readJSON;
    writeJSON = utils.writeJSON;
    YYYYMMDD = utils.YYYYMMDD;
    timestamp = utils.timestamp;

    assign = lodash.assign;
    sample = lodash.sample;
    sampleSize = lodash.sampleSize;
    shuffle = lodash.shuffle;

    get = $.get;
    post = $.post;

    axiosDefaults = $.defaults;

    async wait(delay) {
        return wait(delay);
    }

    async waitRandom(min, max) {
        return wait(utils.random(min, max));
    }

    async readMyJson(fileName) {
        try {
            const result = await utils.readJSON(`./datas/${fileName}.json`);
            if (result) return result;
        } catch (error) {
            //读取本地文件失败
        }
        
        try {
            const response = await axios.get(`https://gitee.com/linc21/jd_tasks/raw/master/datas/${fileName}.json`, {
                headers: {
                    "Referer": `https://gitee.com/linc21/jd_tasks/blob/master/datas/${fileName}.json`,
                    "User-Agent": UserAgents()
                }
            });
            return response.data;
        } catch (error) {
            this.log(`读取文件失败[${fileName}]`);
        }
    }

    /**
     * 格式化输出当前时间，默认为'yyyy-MM-dd HH:mm:ss.SSS'
     * @returns 当前时间
     */
    now() {
        return utils.logDate();
    }

    /**
     * 当前时间戳(带毫秒)
     * @returns 
     */
     timestampMS() {
        return Date.now();
    }
}

module.exports = Env;