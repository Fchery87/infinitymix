import type { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#0a0a0a',
      color: '#fff'
    }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>{statusCode}</h1>
      <p style={{ fontSize: '1.25rem', color: '#666' }}>
        {statusCode === 404 ? 'Page not found' : 'An error occurred'}
      </p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
