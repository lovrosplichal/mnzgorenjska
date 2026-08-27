export default function Domov() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Gorenjska Fantasy Liga</h1>
      <p className="text-slate-600">
        Sestavi svojo fantasy ekipo iz igralcev 1. Gorenjske nogometne lige. Po vsakem
        krogu oceni predstave igralcev — povprečje ocen skupnosti se pretvori v točke.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-slate-600">
        <li>Ustvari račun in sestavi ekipo.</li>
        <li>Po odigranem krogu oddaj ocene (1–10) za igralce.</li>
        <li>Zberi točke in se povzpni na lestvici.</li>
      </ol>
    </div>
  )
}
