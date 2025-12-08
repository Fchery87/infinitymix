import React from 'react';

export const Html = ({ children, ...props }: React.HTMLAttributes<HTMLHtmlElement>) => (
  <html {...props}>{children}</html>
);

export const Head = ({ children, ...props }: React.HTMLAttributes<HTMLHeadElement>) => (
  <head {...props}>{children}</head>
);

export const Main = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <main {...props}>{children}</main>
);

export const NextScript = ({ children, ...props }: React.ScriptHTMLAttributes<HTMLScriptElement>) => (
  <script {...props}>{children}</script>
);

const documentExports = { Html, Head, Main, NextScript };

export default documentExports;
