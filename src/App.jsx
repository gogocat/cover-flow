import Coverflow from './Coverflow';
import itemsData from './data/albums.json';


function App() {
  return (
    <div className="App">
      <h1>Coverflow Demo</h1>
      <Coverflow items={itemsData} />
    </div>
  );
}

export default App;
