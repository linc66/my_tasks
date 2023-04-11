/*
取关店铺和商品
cron: 50 23 * * *
*/
const Env = require("./Env");
const $ = new Env("取关店铺和商品");

const _ = {

    /** 保留多少的店铺和商品 */
    limit: 50,

    page: 0,
    pageSize: 20,
    totalNum: 0,
    totalPage: 0,
    done: 0,
    shopIds: [],
    commIds: [],

    shopsJson: './datas/shops.json',
    shopsData: {},
};

$.onBefore = async function() {
    $.pushMsg(`取关店铺和商品，保留前${_.limit}个`);
    await initDatas();
}

$.onLogic = async function() {
    await getShopList();
    await batchUnfollowShops();
    await getCommList();
    await batchDelComms();
}

$.onAfter = async function() {
    await saveDatas();
}

$.run({fileName: __filename});

async function initDatas() {
    _.shopsData = await $.readJSON(_.shopsJson);
}

async function saveDatas() {
    await $.writeJSON(_.shopsJson, _.shopsData);
}

async function getShopList() {
    _.page = 0;
    _.totalPage = 0;
    _.totalNum = 0;
    _.done = false;
    _.shopIds = [];
    do {
        _.page++;
        await $.waitRandom(300, 500);
        const data = await getShopListByPage();
        if (data.iRet != 0) break;
        if (_.totalNum === 0) {
            _.totalNum = Number.parseInt(data.totalNum);
            $.pushMsg(`共关注店铺[${_.totalNum}]`);
        }
        if (_.totalPage === 0)
            _.totalPage = Number.parseInt(data.totalPage);
        if (_.page >= _.totalPage) _.done = true;
        const shops = data.data;
        for (const shop of shops) {
            _.shopIds.push(shop.shopId);
            if (!_.shopsData[shop.venderId]) {
                _.shopsData[shop.venderId] = shop.shopName;
                // console.log(`new[${shop.venderId}][${shop.shopName}]`);
            }
        }
    } while (!_.done);
}

async function getShopListByPage() {
    const url = `https://wq.jd.com/fav/shop/QueryShopFavList?cp=${_.page}&pageSize=${_.pageSize}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKA&g_ty=ls`;
    try {
        const response = await $.get(url);
        const data = JSON.parse(response.data.slice(14, -13));
        // console.log(data);
        return data;
    } catch (error) {
        console.error(error.stack);
    }
}

async function batchUnfollowShops() {
    const times = Math.ceil((_.shopIds.length - _.limit) / _.pageSize);
    for (let i = 0; i < times; i++) {
        const start = _.limit + (_.pageSize * i);
        const end = Math.min(start + _.pageSize, _.shopIds.length);
        const shops = _.shopIds.slice(start, end);
        $.log(`正在取消关注店铺[${start+1} ~ ${end}]`);
        await sendUnfollowShops(shops.join(','));
        await $.waitRandom(500, 800);
    }
}

async function sendUnfollowShops(params) {
    const url = `https://wq.jd.com/fav/shop/batchunfollow?shopId=${params}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKN&g_ty=ls`;
    try {
        const response = await $.get(url);
        const data = JSON.parse(response.data.slice(14, -13));
        // console.log(data);
        return data;
    } catch (error) {
        console.error(error.stack);
    }
}

async function getCommList() {
    _.page = 0;
    _.totalPage = 0;
    _.totalNum = 0;
    _.done = false;
    _.commIds = [];
    do {
        _.page++;
        await $.waitRandom(300, 500);
        const data = await getCommListByPage();
        if (data.iRet != 0) break;
        if (_.totalNum === 0) {
            _.totalNum = Number.parseInt(data.totalNum);
            $.pushMsg(`共关注商品[${_.totalNum}]`);
        }
        if (_.totalPage === 0) {
            _.totalPage = Math.ceil(_.totalNum / _.pageSize);
        }
        if (_.page >= _.totalPage) _.done = true;
        const comms = data.data;
        for (const comm of comms) {
            _.commIds.push(comm.commId);
        }
    } while (!_.done);
}

async function getCommListByPage() {
    const url = `https://wq.jd.com/fav/comm/FavCommQueryFilter?cp=${_.page}&pageSize=${_.pageSize}&category=0&promote=0&cutPrice=0&coupon=0&stock=0&areaNo=1_72_4139_0&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKB&g_ty=ls`;
    try {
        const response = await $.get(url);
        const data = JSON.parse(response.data.slice(14, -13));
        // console.log(data);
        return data;
    } catch (error) {
        console.error(error.stack);
    }
}

async function batchDelComms() {
    const times = Math.ceil((_.commIds.length - _.limit) / _.pageSize);
    for (let i = 0; i < times; i++) {
        const start = _.limit + (_.pageSize * i);
        const end = Math.min(start + _.pageSize, _.commIds.length);
        const comms = _.commIds.slice(start, end);
        $.log(`正在取消关注商品[${start+1} ~ ${end}]`);
        await sendDelComms(comms.join(','));
        await $.waitRandom(500, 800);
    }
}

async function sendDelComms(params) {
    const url = `https://wq.jd.com/fav/comm/FavCommBatchDel?commId=${params}&_=${Date.now()}&sceneval=2&g_login_type=1&callback=jsonpCBKPP&g_ty=ls`;
    try {
        const response = await $.get(url);
        // console.log(response.data);
    } catch (error) {
        console.error(error.stack);
    }
}

// https://wq.jd.com/fav/shop/QueryShopFavList?cp=1&pageSize=10&lastlogintime=1646247508&_=1646247778741&sceneval=2&g_login_type=1&callback=jsonpCBKA&g_ty=ls
// https://wq.jd.com/fav/shop/batchunfollow?shopId=1000389063,835080&_=1646245806200&sceneval=2&g_login_type=1&callback=jsonpCBKN&g_ty=ls
// https://wq.jd.com/fav/comm/FavCommQueryFilter?cp=1&pageSize=10&category=0&promote=0&cutPrice=0&coupon=0&stock=0&areaNo=1_72_4139_0&_=1646246981070&sceneval=2&g_login_type=1&callback=jsonpCBKB&g_ty=ls
// https://wq.jd.com/fav/comm/FavCommBatchDel?commId=10026757510475,100015894449,100002787838,10043914317896,1424996&_=1646247215016&sceneval=2&g_login_type=1&callback=jsonpCBKPP&g_ty=ls