import type { ComponentType, RefAttributes } from 'react';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewProps,
} from 'react-native-webview';

// react-native-webview 14 defaults its class generic to undefined, which makes
// every JSX prop resolve to never under React Native 0.88's stricter types.
export type CompatibleWebViewHandle = WebView<object>;

export const CompatibleWebView = WebView as unknown as ComponentType<
  WebViewProps & RefAttributes<CompatibleWebViewHandle>
>;

export type { WebViewMessageEvent };
