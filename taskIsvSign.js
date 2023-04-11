/*
功能： ISV签到
入口： ISV签到
定时： 1 2 * * *
超级福利社 https://lzkj-isv.isvjcloud.com/wxAssemblePage/activity/67dfd244aacb438893a73a03785a48c7?activityId=67dfd244aacb438893a73a03785a48c7&adsource=tg_qrCode
*/
const Env = require("./Env");
const $ = new Env("ISV签到");

$.onBefore = onBefore;
$.onLogic = onLogic;
$.run({fileName: __filename, debugMode: true});

//配置
const config = {
    lzkj: [],
    lzkj_7d: [],
    cjhy: [],
    cjhy_7d: [],
};
 
 //本地变量
const _ = {
    isvPostConfig: {
        baseURL: '',
        headers : {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        }
    },
    get baseURL(){return this.isvPostConfig.baseURL;},
    /**
     * @param {string} url
     */
    set baseURL(url) {
        this.isvPostConfig.headers.Origin = this.isvPostConfig.baseURL = url;
    },
    shopIndex: 0,
    activityUrl: '',
    activityId: '',
    venderId: 0,
    shopName: '',
    activityType: 0,
    isvCookie: '',
    isvCookieMap: new Map(),
    token: '',
    secretPin: '',
}
 
async function onBefore() {
    await initDatas();
    // showNames();
}

async function initDatas() {
    await $.wait(1);
    const result = JSON.parse(process.env.ISV_SIGN);
    if (!result) return;
    $.assign(config, result);
}

function showNames() {
    $.pushMsg('签到店铺：')
    _.shopIndex = 1;
    for (const vo of config.lzkj) {
        $.pushMsg(`${$.pad(_.shopIndex++)}|${vo.shopName}`);
    }
    for (const vo of config.lzkj_7d) {
        $.pushMsg(`${$.pad(_.shopIndex++)}|${vo.shopName}`);
    }
    for (const vo of config.cjhy) {
        $.pushMsg(`${$.pad(_.shopIndex++)}|${vo.shopName}`);
    }
    for (const vo of config.cjhy_7d) {
        $.pushMsg(`${$.pad(_.shopIndex++)}|${vo.shopName}`);
    }
}

async function onLogic() {
    initMsgList();
    await lzkjSign();
    await lzkj7dSign();
    await cjhySign();
    await cjhy7dSign();
    pushMessages();
}

function initMsgList() {
    _.shopIndex = 0;
    _.msgExceptions = [];
    _.msgErrors = [];
    _.msgBlacks = [];
    _.msgFails = [];
    _.msgSuccess = [];
    _.msgEnd = [];
    _.msgMember = [];
    _.msgMiss = [];
    _.msgSigned = [];
}

function pushMessages() {
    $.log('\n消息推送：');
    tryPushMsg('成功', _.msgSuccess);
    tryPushMsg('已签', _.msgSigned);
    // tryPushMsg('错过', _.msgMiss);
    // tryPushMsg('风控', _.msgBlacks);
    tryPushMsg('结束', _.msgEnd);
    tryPushMsg('失败', _.msgFails);
    tryPushMsg('错误', _.msgErrors);
    tryPushMsg('异常', _.msgExceptions);
    tryPushMsg('入会', _.msgMember);
}

function tryPushMsg(msg, array) {
    if (array.length <= 0) return;
    $.pushMsg(`${msg}|${array.join()}`);
}

async function lzkjSign() {
    _.baseURL = 'https://lzkj-isv.isvjcloud.com';
    _.stop = false;
    for (const vo of config.lzkj) {
        if (vo.skip) continue;
        _.activityId = vo.activityId;
        _.venderId = vo.venderId;
        _.shopName = vo.shopName;
        _.activityType = vo.activityType;
        _.activityUrl = `${_.baseURL}/sign/signActivity2?activityId=${_.activityId}&venderId=${_.venderId}&sid=&un_area=`;
        await signActivity();
        if (_.stop) break;
    }
}

async function lzkj7dSign() {
    _.baseURL = 'https://lzkj-isv.isvjcloud.com';
    _.stop = false;
    for (const vo of config.lzkj_7d) {
        if (vo.skip) continue;
        _.activityId = vo.activityId;
        _.venderId = vo.venderId;
        _.shopName = vo.shopName;
        _.activityType = vo.activityType;
        _.activityUrl = `h${_.baseURL}/sign/sevenDay/signActivity?activityId=${_.activityId}&venderId=${_.venderId}&sid=&un_area=`;
        await signActivity(true);
        if (_.stop) break;
    }
}

async function cjhySign() {
    _.baseURL = 'https://cjhy-isv.isvjcloud.com';
    _.stop = false;
    for (const vo of config.cjhy) {
        if (vo.skip) continue;
        _.activityId = vo.activityId;
        _.venderId = vo.venderId;
        _.shopName = vo.shopName;
        _.activityType = vo.activityType;
        _.activityUrl = `${_.baseURL}/sign/signActivity?activityId=${_.activityId}&venderId=${_.venderId}&adsource=&sid=&un_area=`;
        await signActivity();
        if (_.stop) break;
    }
}

async function cjhy7dSign() {
    _.baseURL = 'https://cjhy-isv.isvjcloud.com';
    _.stop = false;
    for (const vo of config.cjhy_7d) {
        if (vo.skip) continue;
        _.activityId = vo.activityId;
        _.venderId = vo.venderId;
        _.shopName = vo.shopName;
        _.activityType = vo.activityType;
        _.activityUrl = `${_.baseURL}/sign/sevenDay/signActivity?activityId=${_.activityId}&venderId=${_.venderId}&adsource=&sid=&un_area=`;
        await signActivity(true);
        if (_.stop) break;
    }
}

async function signActivity(is7day = false) {
    try {
        _.shopIndex++;
        _.UUID = $.randomString(40);
        _.ADID = $.uuid();
        _.isvPostConfig.headers["User-Agent"] = `jdapp;iPhone;9.5.4;13.6;${_.UUID};network/wifi;ADID/${_.ADID};model/iPhone10,3;addressid/0;appBuild/167668;jdSupportDarkMode/0;Mozilla/5.0 (iPhone; CPU iPhone OS 13_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148;supportJDSHWK/1`;
        let result = await initIsvCookie();
        if (!result) return;
        _.isvPostConfig.headers["Referer"] = _.activityUrl;
        await $.waitRandom(1000, 2000);
        _.token = await getToken();
        if (!_.token) return;
        _.isvCookieMap.set('isvToken', _.token);
        await $.waitRandom(1000, 2000);
        await getSimpleActInfoVo();
        await $.waitRandom(1000, 2000);
        _.secretPin = await getMyPing();
        if (!_.secretPin) return;
        await $.waitRandom(1000, 2000);
        await accessLogWithAD();
        await $.waitRandom(1000, 2000);
        await getInfo(is7day);
        await $.waitRandom(1000, 2000);
        await signUp(is7day);
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|signActivity|${error.message}`);
    } finally {
        await $.waitRandom(1000, 2000);
    }
}

async function initIsvCookie() {
    try {
        _.isvCookie = $.cookie;
        let response = await $.get(_.activityUrl);
        resetIsvCookie(response.headers["set-cookie"]);
        return true;
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|initIsvCookie|${error.message}`);
        return false;
    }
}

function resetIsvCookie(cookies) {
    for (const ck of cookies) {
        const matched = ck.match(/^(.*?)=(.*?);/);
        _.isvCookieMap.set(matched[1], matched[2]);
    }
    _.isvCookie = $.cookie;
    for (const [key, value] of _.isvCookieMap) {
        _.isvCookie += `${key}=${value};`;
    }
    _.isvPostConfig.headers.Cookie = _.isvCookie;
}

async function getToken() {
    try {
        const url = `https://api.m.jd.com/client.action?functionId=isvObfuscator`;
        const body = `body=%7B%22url%22%3A%22https%3A//lzkjdz-isv.isvjcloud.com%22%2C%22id%22%3A%22%22%7D&uuid=9a79133855e4ed42e83cda6c58b51881c4519236&client=apple&clientVersion=10.1.4&st=1647263148203&sv=102&sign=53ee02a59dece3c480e3fcb067c49954`;
        const response = await $.post(url, body);
        const data = response.data;
        if (data.code === "0") {
            return data.token;
        } else {
            $.logToJson(data);
            _.msgErrors.push(_.shopName);
        }
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|getToken|${error.message}`);
    }
}

async function getSimpleActInfoVo() {
    try {
        const url = '/customer/getSimpleActInfoVo';
        const body = `activityId=${_.activityId}`;
        const response = await $.post(url, body, _.isvPostConfig);
        const data = response.data;
        // if ($.debugMode) $.logToJson(data);   
        if (!data.result) {
            $.log(`错误|${_.shopIndex}|${_.shopName}|getSimpleActInfoVo|${data.errorMessage}`);
            _.msgErrors.push(_.shopName);
            return false;
        }
        
        resetIsvCookie(response.headers["set-cookie"]);
        return true;
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|getSimpleActInfoVo|${error.message}`);
    }
}

async function getMyPing() {
    try {
        const url = '/customer/getMyPing';
        const body = `userId=${_.venderId}&token=${_.token}&fromType=APP`;
        const response = await $.post(url, body, _.isvPostConfig);
        const data = response.data;
        
        if (!data.result) {
            if (data.data === '400001') {
                $.log(`风控|${_.shopIndex}`);
                _.msgBlacks.push(_.shopIndex);
                _.stop = true;
            } else {
                _.msgErrors.push(_.shopName);
                $.logToJson(data);
            }
            return false;
        }
        
        resetIsvCookie(response.headers["set-cookie"]);

        return data.data?.secretPin;
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|getMyPing|${error.message}`);
    }
}

async function accessLogWithAD() {
    try {
        const url = '/common/accessLogWithAD';
        const body = `venderId=${_.venderId}&code=${_.activityType}&pin=${encodeURIComponent(_.secretPin)}&activityId=${_.activityId}&pageUrl=${encodeURIComponent(_.activityUrl)}&subType=app&adSource=`;
        const response = await $.post(url, body, _.isvPostConfig);
        resetIsvCookie(response.headers["set-cookie"]);
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|accessLogWithAD|${error.message}`);
    }
}

async function getInfo(is7day = false) {
    if (is7day) return;
    try {
        const url = `${_.baseURL}/miniProgramShareInfo/getInfo?activityId=${_.activityId}`;
        let response = await $.get(url);
        resetIsvCookie(response.headers["set-cookie"]);
        return true;
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|getInfo|${error.message}`);
        return false;
    }
}

async function signUp(is7day = false) {
    try {
        const url = is7day ? '/sign/sevenDay/wx/signUp' : '/sign/wx/signUp';
        const body = `actId=${_.activityId}&venderId=${_.venderId}&pin=${encodeURIComponent(_.secretPin)}`;
        const response = await $.post(url, body, _.isvPostConfig);
        const data = response.data;
        
        if (data.isOk) {
            // $.logToJson(data);
            const giftName = is7day ? data.signResult?.gift?.giftName : data.gift?.giftName;
            $.log(`成功|${_.shopIndex}|${_.shopName}|${giftName}`);
            _.msgSuccess.push(_.shopName);
        } else if (data.msg === '当天只能签到一次') {
            $.log(`已签|${_.shopIndex}|${_.shopName}`);
            _.msgSigned.push(_.shopName);
        } else if (data.msg == null) {
            $.log(`失败|${_.shopIndex}|${_.shopName}|${$.toJson(data)}`);
            _.msgFails.push(_.shopName);
        } else if (data.msg.includes('结束')) {
            $.log(`结束|${_.shopIndex}|${_.shopName}`);
            _.msgEnd.push(_.shopName);
        } else if (data.msg.includes('擦肩而过')) {
            $.log(`错过|${_.shopIndex}|${_.shopName}`);
            _.msgMiss.push(_.shopName);
            _.stop = true;
        } else if (data.msg.includes('活动仅限店铺会员参与哦')) {
            $.log(`入会|${_.shopIndex}|${_.shopName}`);
            _.msgMember.push(_.shopName);
        } else {
            $.log(`失败|${_.shopIndex}|${_.shopName}|${$.toJson(data)}`);
            _.msgFails.push(_.shopName);
        }
    } catch (error) {
        _.msgExceptions.push(_.shopName);
        $.log(`异常|${_.shopIndex}|${_.shopName}|signUp|${error.message}`);
    }
}