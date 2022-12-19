import * as assert from 'assert';
import { after } from 'mocha';

import {buildLogMessage} from '../../logging';

suite("Extension Test Suite", () => {
  test("Log message is built properly", () => {
    assert.strictEqual(
      buildLogMessage("debug", "myMessage"),
      "KataPod [DEBUG] myMessage",
    );
  });
});
