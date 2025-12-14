import React from 'react';

export default class ErrorBoundary extends React.Component<any, {error: any}> {
  constructor(props:any){
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error:any){
    return { error };
  }
  componentDidCatch(error:any, info:any){
    console.error('ErrorBoundary caught', error, info);
  }
  render(){
    if(this.state.error){
      return (
        <div style={{padding:20}}>
          <h2>Произошла ошибка в приложении</h2>
          <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children;
  }
}

