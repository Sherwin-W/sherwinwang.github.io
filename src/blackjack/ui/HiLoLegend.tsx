export default function HiLoLegend() {
  return (
    <table className="bj-legend">
      <caption>Hi-Lo card values</caption>
      <thead><tr><th scope="col">Cards</th><th scope="col">Count change</th><th scope="col">Marker</th></tr></thead>
      <tbody>
        <tr className="bj-legend__low"><th scope="row">2 3 4 5 6</th><td>+1</td><td>▲ green</td></tr>
        <tr className="bj-legend__neutral"><th scope="row">7 8 9</th><td>0</td><td>● yellow</td></tr>
        <tr className="bj-legend__high"><th scope="row">10 J Q K A</th><td>−1</td><td>▼ red</td></tr>
      </tbody>
    </table>
  );
}
