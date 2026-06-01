// 微信开放平台 API mock (nock)
// ============================================================================
// 用法:
//   import { WechatMock } from 'test/helpers/wechat-mock';
//   beforeEach(() => WechatMock.reset());
//   it('...', async () => {
//     WechatMock.setupComponentToken();
//     // 调用业务代码 ...
//   });
// ============================================================================
import nock from 'nock';

const WECHAT_API = 'https://api.weixin.qq.com';

export const WechatMock = {
  /**
   * Mock 第三方平台 access_token 接口。
   * POST /cgi-bin/component/api_component_token
   */
  setupComponentToken(): nock.Scope {
    return nock(WECHAT_API)
      .post('/cgi-bin/component/api_component_token')
      .reply(200, {
        component_access_token: 'mock_comp_token',
        expires_in: 7200,
      });
  },

  /**
   * Mock 创建预授权码接口。
   * POST /cgi-bin/component/api_create_preauthcode
   */
  setupPreauthCode(): nock.Scope {
    return nock(WECHAT_API)
      .post('/cgi-bin/component/api_create_preauthcode')
      .query(true)
      .reply(200, {
        pre_auth_code: 'mock_preauth',
        expires_in: 1800,
      });
  },

  /**
   * Mock 授权方信息查询接口。
   * POST /cgi-bin/component/api_query_auth
   */
  setupQueryAuth(): nock.Scope {
    return nock(WECHAT_API)
      .post('/cgi-bin/component/api_query_auth')
      .query(true)
      .reply(200, {
        authorization_info: {
          authorizer_appid: 'wxmock123',
          authorizer_access_token: 'mock_authorizer_token',
          authorizer_refresh_token: 'mock_refresh',
          expires_in: 7200,
          func_info: [],
        },
      });
  },

  /**
   * 清理所有 nock 拦截器。每个 test 后或 beforeEach 调用。
   */
  reset(): void {
    nock.cleanAll();
  },

  /**
   * 断言所有已注册的 mock 都被消费过 (调用方主动校验)。
   */
  assertAllConsumed(): void {
    if (!nock.isDone()) {
      const pending = nock.pendingMocks();
      throw new Error(`Pending nock mocks: ${pending.join(', ')}`);
    }
  },
};
