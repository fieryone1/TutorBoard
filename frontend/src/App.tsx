import Whiteboard from './Whiteboard'

const room = new URLSearchParams(window.location.search).get('room') ?? 'demo-room'

export default function App() {
  return <Whiteboard room={room} />
}
