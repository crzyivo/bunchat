import Register from './components/register';
export default function Home(props: { searchCount?: number }) {
    return (
      <div>
        <h1>Chat</h1>
        <Register/>
      </div>
    );
  }