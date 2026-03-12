import { handleMessage } from './handlers/command-handler.ts';
import type { ExtensionRequest } from '../shared/message-types.ts';

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  handleMessage(request, sendResponse);
  return true; // keep message channel open for async response
});
