/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Services} from '../../../src/services';
import {dict} from '../../../src/utils/object';
import {
  getViewerAuthTokenIfAvailable,
  getViewerInterceptResponse,
  setupAMPCors,
  setupInit,
  setupJsonFetchInit,
} from '../../../src/utils/xhr-utils';

describes.sandboxed('utils/xhr-utils', {}, env => {
  let sandbox;

  beforeEach(() => {
    sandbox = env.sandbox;
  });

  describe('setupAMPCors', () => {
    it('should set AMP-Same-Origin header', () => {
      // Given a same origin request.
      const fetchInitDef = setupAMPCors(
        {origin: 'http://www.origin.org'},
        'http://www.origin.org',
        {}
      );
      // Expect proper header to be set.
      expect(fetchInitDef['headers']['AMP-Same-Origin']).to.equal('true');
    });

    it('should not set AMP-Same-Origin header', () => {
      // If not a same origin request.
      const fetchInitDef = setupAMPCors(
        {origin: 'http://www.originz.org'},
        'http://www.origin.org',
        {headers: {}}
      );
      expect(fetchInitDef['headers']['AMP-Same-Origin']).to.be.undefined;
    });
  });

  describe('setupInit', () => {
    it('should set up init', () => {
      const init = setupInit();
      expect(init).to.deep.equal({method: 'GET', headers: {}});
    });

    it('should set up init with Accept header value', () => {
      const init = setupInit(undefined, 'text/html');
      expect(init['headers']['Accept']).to.equal('text/html');
    });

    it('should handle null credentials', () => {
      allowConsoleError(() => {
        expect(() => {
          setupInit({credentials: null}, 'text/html');
        }).to.throw(/Only credentials=include\|omit support: null/);
      });
    });
  });

  describe('setupJsonFetchInit', () => {
    it('set proper properties', () => {
      expect(setupJsonFetchInit({body: {}})).to.deep.equal({
        headers: {
          'Accept': 'application/json',
        },
        body: {},
        method: 'GET',
      });

      expect(setupJsonFetchInit({body: {}, method: 'POST'})).to.deep.equal({
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: '{}',
        method: 'POST',
      });
    });
  });

  describe('getViewerInterceptResponse', () => {
    let ampDocSingle, doc, init, input, viewer, viewerForDoc, win;

    beforeEach(() => {
      ampDocSingle = {
        getRootNode: () => {
          return {documentElement: doc};
        },
      };
      doc = document.createElement('html');
      doc.setAttribute('allow-xhr-interception', 'true');
      init = {};
      input = 'https://sample.com';
      viewer = {
        hasCapability: unusedParam => true,
        isTrustedViewer: () => Promise.resolve(true),
        sendMessageAwaitResponse: sandbox.stub().returns(Promise.resolve({})),
        whenFirstVisible: sandbox.stub().returns(Promise.resolve()),
      };
      viewerForDoc = sandbox.stub(Services, 'viewerForDoc').returns(viewer);
      win = {
        __AMP_MODE: {
          localDev: false,
        },
        location: {
          hash: '',
        },
      };
    });

    it('should be no-op if amp doc is absent', async () => {
      ampDocSingle = null;

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      // Expect no-op.
      expect(viewerForDoc).to.not.have.been.called;
    });

    it('should not intercept if viewer can not intercept', async () => {
      viewer.hasCapability = unusedParam => false;

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      // Expect no interception.
      expect(viewer.sendMessageAwaitResponse).to.not.have.been.called;
    });

    it('should not intercept if request is initialized to bypass for local development', async () => {
      // Given the bypass flag and localDev being true.
      init = {
        bypassInterceptorForDev: true,
      };
      win.__AMP_MODE = {
        localDev: true,
      };

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      // Expect no interception.
      expect(viewer.sendMessageAwaitResponse).to.not.have.been.called;
    });

    it('should not intercept if amp doc does not support xhr interception', async () => {
      doc.removeAttribute('allow-xhr-interception');

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      // Expect no interception.
      expect(viewer.sendMessageAwaitResponse).to.not.have.been.called;
    });

    it('should not intercept if URL is known as a proxy URL', async () => {
      input = 'https://cdn.ampproject.org';

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      // Expect no interception.
      expect(viewer.sendMessageAwaitResponse).to.not.have.been.called;
    });

    it('should send xhr request to viewer', async () => {
      init = {
        body: {},
      };
      input = 'https://www.shouldsendxhrrequesttoviewer.org';

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      const msgPayload = dict({
        'originalRequest': {
          'input': 'https://www.shouldsendxhrrequesttoviewer.org',
          'init': {
            'body': {},
          },
        },
      });
      expect(viewer.sendMessageAwaitResponse).to.have.been.calledOnceWith(
        'xhr',
        msgPayload
      );
    });

    it('should wait for visibility', async () => {
      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      expect(viewer.whenFirstVisible).to.have.been.calledOnce;
    });

    it('should not wait for visibility if prerenderSafe', async () => {
      init = {
        prerenderSafe: true,
      };

      await getViewerInterceptResponse(win, ampDocSingle, input, init);

      expect(viewer.whenFirstVisible).to.not.have.been.called;
    });
  });

  describe('getViewerAuthTokenIfAvailable', () => {
    it('should return undefined if crossorigin attr is not present', () => {
      const el = document.createElement('html');
      return getViewerAuthTokenIfAvailable(el).then(token => {
        expect(token).to.equal(undefined);
      });
    });

    it(
      'should return undefined if crossorigin attr does not contain ' +
        'exactly "amp-viewer-auth-token-post"',
      () => {
        const el = document.createElement('html');
        el.setAttribute('crossorigin', '');
        return getViewerAuthTokenIfAvailable(el).then(token => {
          expect(token).to.be.undefined;
        });
      }
    );

    it('should return an auth token if one is present', () => {
      sandbox.stub(Services, 'viewerAssistanceForDocOrNull').returns(
        Promise.resolve({
          getIdTokenPromise: () => Promise.resolve('idToken'),
        })
      );
      const el = document.createElement('html');
      el.setAttribute('crossorigin', 'amp-viewer-auth-token-via-post');
      return getViewerAuthTokenIfAvailable(el).then(token => {
        expect(token).to.equal('idToken');
      });
    });

    it('should return an empty auth token if there is not one present', () => {
      sandbox.stub(Services, 'viewerAssistanceForDocOrNull').returns(
        Promise.resolve({
          getIdTokenPromise: () => Promise.resolve(undefined),
        })
      );
      const el = document.createElement('html');
      el.setAttribute('crossorigin', 'amp-viewer-auth-token-via-post');
      return getViewerAuthTokenIfAvailable(el).then(token => {
        expect(token).to.equal('');
      });
    });

    it(
      'should return an empty auth token if there is an issue retrieving ' +
        'the identity token',
      () => {
        sandbox.stub(Services, 'viewerAssistanceForDocOrNull').returns(
          Promise.reject({
            getIdTokenPromise: () => Promise.reject(),
          })
        );
        const el = document.createElement('html');
        el.setAttribute('crossorigin', 'amp-viewer-auth-token-via-post');
        return getViewerAuthTokenIfAvailable(el).then(token => {
          expect(token).to.equal('');
        });
      }
    );

    it('should assert that amp-viewer-assistance extension is present', () => {
      sandbox
        .stub(Services, 'viewerAssistanceForDocOrNull')
        .returns(Promise.resolve());
      const el = document.createElement('html');
      el.setAttribute('crossorigin', 'amp-viewer-auth-token-via-post');
      expectAsyncConsoleError(
        'crossorigin="amp-viewer-auth-token-post" ' +
          'requires amp-viewer-assistance extension.',
        1
      );
      return getViewerAuthTokenIfAvailable(el).then(
        undefined,
        e => expect(e).to.not.be.undefined
      );
    });
  });
});
