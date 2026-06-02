// test/e2e/helpers/wechat-mock.ts
// 微信 API nock 助手: 复用 S1 模式, 集中 mock 常用 endpoint
import nock from 'nock';

const WECHAT = 'https://api.weixin.qq.com';

export const WechatMock = {
  setupComponentToken() {
    nock(WECHAT)
      .post('/cgi-bin/component/api_component_token')
      .reply(200, {
        component_access_token: 'mock_component_token',
        expires_in: 7200,
      });
  },

  setupPreauthCode() {
    nock(WECHAT)
      .post('/cgi-bin/component/api_create_preauthcode')
      .reply(200, {
        preauth_code: 'mock_preauth',
        expires_in: 1800,
      });
  },

  setupQueryAuth() {
    nock(WECHAT)
      .post('/cgi-bin/component/api_query_auth')
      .reply(200, {
        authorization_info: {
          authorizer_appid: 'wxmock123',
          authorizer_access_token: 'mock_authorizer_token',
          expires_in: 7200,
          authorizer_refresh_token: 'mock_refresh',
          func_info: [],
        },
      });
  },

  setupBroadcastOk(msgId = 'mock_msg_1') {
    nock(WECHAT)
      .post('/cgi-bin/message/mass/sendall')
      .reply(200, { errcode: 0, errmsg: 'ok', msg_id: msgId, msg_data_id: 'd1' });
  },

  setupBroadcastError(errcode = 40001, errmsg = 'invalid credential') {
    nock(WECHAT)
      .post('/cgi-bin/message/mass/sendall')
      .reply(200, { errcode, errmsg });
  },

  setupFreqLimit() {
    nock(WECHAT)
      .post('/cgi-bin/component/api_component_token')
      .reply(45009, { errcode: 45009, errmsg: 'freq limit' });
  },

  cleanAll() {
    nock.cleanAll();
  },
};
