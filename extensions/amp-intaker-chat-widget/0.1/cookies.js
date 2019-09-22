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

import {getCookie, setCookie} from '../../../src/cookies';
import {parseJson} from '../../../src/json';

/**
 * @constructor
 */
export class CookiesAPI {
  /**
   *
   * @param {!Window} win
   * @constructor
   */
  constructor(win) {
    this.win = win;
  }

  /**
   *
   * @param {string} key
   * @param {string} value
   * @param {Object} attributes
   */
  set(key, value, attributes) {
    setCookie(this.win, key, JSON.stringify(value), attributes.expires);
  }

  /**
   *
   * @param {string} key
   * @return {?JsonObject|null|string}
   */
  getJSON(key) {
    let cookie = getCookie(this.win, key);
    if (cookie) {
      cookie = parseJson(cookie);
    }

    return cookie;
  }

  /**
   *
   * @param {string} key
   * @return {?string|null}
   */
  get(key) {
    return getCookie(this.win, key);
  }
}