const WS_URL = 'ws://127.0.0.1:7865';
let ws = null;
let reconnectDelay = 1000;

chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {
  if (!ws || ws.readyState !== WebSocket.OPEN) connect();
});

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Action Bridge] Connected');
    reconnectDelay = 1000;
  };

  ws.onmessage = async (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    const { id, action, tabId, code, url, params } = msg;
    let result;

    try {
      const target = tabId || (await getActiveTabId());

      if (action === 'reload') {
        result = { id, ok: true, data: 'reloading' };
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(result));
        }
        chrome.runtime.reload();
        return;

      } else if (action === 'tabs') {
        const tabs = await chrome.tabs.query({});
        result = { id, ok: true, data: tabs.map(t => ({ id: t.id, url: t.url, title: t.title })) };

      } else if (action === 'eval' || action === 'runAction') {
        if (!target) throw new Error('No active tab');

        // Use chrome.debugger to evaluate in page context — no CSP issues
        await chrome.debugger.attach({ tabId: target }, '1.3');
        try {
          var expr;
          if (action === 'runAction') {
            var paramsJson = JSON.stringify(params || {});
            expr = '(async function(){ try { var tool = (' + code + '); if (tool && typeof tool.execute === "function") { return await tool.execute(' + paramsJson + '); } return {error:"No execute"}; } catch(e) { return {error:e.message}; } })()';
          } else {
            expr = '(' + code + ')';
          }
          const res = await chrome.debugger.sendCommand(
            { tabId: target },
            'Runtime.evaluate',
            { expression: expr, returnByValue: true, awaitPromise: true }
          );
          await chrome.debugger.detach({ tabId: target });

          if (res.exceptionDetails) {
            result = { id, ok: false, error: res.exceptionDetails.text || 'Evaluation error' };
          } else {
            result = { id, ok: true, data: res.result?.value };
          }
        } catch (e) {
          try { await chrome.debugger.detach({ tabId: target }); } catch {}
          throw e;
        }

      } else if (action === 'type') {
        // Type text character by character using CDP Input.dispatchKeyEvent
        if (!target) throw new Error('No active tab');
        var text = msg.text || '';
        await chrome.debugger.attach({ tabId: target }, '1.3');
        try {
          for (var ci = 0; ci < text.length; ci++) {
            var ch = text[ci];
            await chrome.debugger.sendCommand({ tabId: target }, 'Input.dispatchKeyEvent', {
              type: 'keyDown', text: ch, key: ch, code: '', windowsVirtualKeyCode: ch.charCodeAt(0), nativeVirtualKeyCode: ch.charCodeAt(0)
            });
            await chrome.debugger.sendCommand({ tabId: target }, 'Input.dispatchKeyEvent', {
              type: 'keyUp', key: ch, code: '', windowsVirtualKeyCode: ch.charCodeAt(0), nativeVirtualKeyCode: ch.charCodeAt(0)
            });
          }
          await chrome.debugger.detach({ tabId: target });
          result = { id, ok: true, data: { typed: text } };
        } catch (e) {
          try { await chrome.debugger.detach({ tabId: target }); } catch {}
          throw e;
        }

      } else if (action === 'cdp') {
        // Run one or more CDP commands in sequence (keeps debugger attached)
        if (!target) throw new Error('No active tab');
        await chrome.debugger.attach({ tabId: target }, '1.3');
        try {
          var commands = msg.commands || [{ method: msg.method, params: msg.cdpParams || {} }];
          var results = [];
          for (var ci = 0; ci < commands.length; ci++) {
            var r = await chrome.debugger.sendCommand({ tabId: target }, commands[ci].method, commands[ci].params || {});
            results.push(r);
          }
          await chrome.debugger.detach({ tabId: target });
          result = { id, ok: true, data: results.length === 1 ? results[0] : results };
        } catch (e) {
          try { await chrome.debugger.detach({ tabId: target }); } catch {}
          throw e;
        }

      } else if (action === 'evalInFrame') {
        // Evaluate JS in a specific frame (e.g., payment iframe)
        if (!target) throw new Error('No active tab');
        var frameUrl = msg.frameUrl || '';
        await chrome.debugger.attach({ tabId: target }, '1.3');
        try {
          // Enable Runtime to get execution contexts
          await chrome.debugger.sendCommand({ tabId: target }, 'Runtime.enable', {});
          // Get all contexts
          var contexts = [];
          // Use a listener to collect contexts
          await new Promise(function(resolve) {
            var handler = function(source, method, params) {
              if (method === 'Runtime.executionContextCreated') {
                contexts.push(params.context);
              }
            };
            chrome.debugger.onEvent.addListener(handler);
            // Disable then re-enable to trigger fresh context events
            chrome.debugger.sendCommand({ tabId: target }, 'Runtime.disable', {}).then(function() {
              return chrome.debugger.sendCommand({ tabId: target }, 'Runtime.enable', {});
            }).then(function() {
              setTimeout(function() {
                chrome.debugger.onEvent.removeListener(handler);
                resolve();
              }, 1000);
            });
          });
          // Find the matching frame context
          var ctx = contexts.find(function(c) { return c.origin && frameUrl && c.origin.includes(frameUrl); });
          if (!ctx) {
            await chrome.debugger.detach({ tabId: target });
            throw new Error('Frame not found. Available: ' + contexts.map(function(c){return c.origin}).join(', '));
          }
          var evalResult = await chrome.debugger.sendCommand({ tabId: target }, 'Runtime.evaluate', {
            expression: code, contextId: ctx.id, returnByValue: true, awaitPromise: true
          });
          await chrome.debugger.detach({ tabId: target });
          if (evalResult.exceptionDetails) {
            result = { id, ok: false, error: evalResult.exceptionDetails.text };
          } else {
            result = { id, ok: true, data: evalResult.result?.value };
          }
        } catch (e) {
          try { await chrome.debugger.detach({ tabId: target }); } catch {}
          throw e;
        }

      } else if (action === 'click') {
        // Click at x,y coordinates using CDP
        if (!target) throw new Error('No active tab');
        var x = msg.x, y = msg.y;
        await chrome.debugger.attach({ tabId: target }, '1.3');
        try {
          await chrome.debugger.sendCommand({ tabId: target }, 'Input.dispatchMouseEvent', {
            type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1
          });
          await chrome.debugger.sendCommand({ tabId: target }, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1
          });
          await chrome.debugger.detach({ tabId: target });
          result = { id, ok: true, data: { clicked: { x, y } } };
        } catch (e) {
          try { await chrome.debugger.detach({ tabId: target }); } catch {}
          throw e;
        }

      } else if (action === 'navigate') {
        if (!url) throw new Error('url required');
        if (!target) throw new Error('No active tab');
        const tab = await chrome.tabs.update(target, { url });
        result = { id, ok: true, data: { id: tab.id, url: tab.url, title: tab.title } };

      } else {
        throw new Error('Unknown action: ' + action);
      }
    } catch (e) {
      result = { id, ok: false, error: e.message };
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(result));
    }
  };

  ws.onclose = () => {
    ws = null;
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  };

  ws.onerror = (error) => {
    console.error('[Action Bridge] WebSocket error:', error);
    // Check if it's a connection refused error
    if (error.message && error.message.includes('ERR_CONNECTION_REFUSED')) {
      console.log('[Action Bridge] Connection refused, will retry in 30 seconds');
      ws.close();
      // Set a fixed 30-second retry for connection refused errors
      setTimeout(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.log('[Action Bridge] Retrying connection after connection refused');
          connect();
        }
      }, 30000);
    } else {
      ws.close();
    }
  };
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

connect();
