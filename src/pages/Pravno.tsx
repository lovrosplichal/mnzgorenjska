// Kratka izjava o zasebnosti in pogoji. Namenoma brez pravniškega balasta —
// pove, kaj hranimo, zakaj in kako se tega znebiš.
export default function Pravno() {
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-black naslov sm:text-3xl">
          Zasebnost in pogoji
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Zadnja sprememba: 28. avgust 2026
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Kaj je SLFF</h2>
        <p className="text-slate-300">
          SLFF (Sunday League Fantasy Football) je navijaška fantasy liga za 1.
          Gorenjsko nogometno ligo. Vodimo jo ljubiteljsko in ni povezana z MNZ
          Gorenjska, NZS ali s klubi. Igra je brezplačna in brez denarnih vložkov
          ali nagrad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Kateri podatki se hranijo</h2>
        <ul className="space-y-2 text-slate-300">
          <li>
            <strong>E-poštni naslov in geslo.</strong> Rabimo ju za prijavo.
            Geslo je shranjeno šifrirano in ga ne vidimo.
          </li>
          <li>
            <strong>Prikazno ime in ime ekipe.</strong> Vidna sta na lestvici.
            Če nočeš svojega imena, uporabi vzdevek.
          </li>
          <li>
            <strong>Tvoja ekipa in glasovi.</strong> Sestava kadra, kapetan,
            prestopi in glasovi o asistencah ali pozicijah.
          </li>
        </ul>
        <p className="text-slate-300">
          Ne hranimo naslova, telefonske številke ali podatkov o plačilih.
          Piškotkov za sledenje in oglaševalskih orodij ne uporabljamo — edini
          shranjeni podatek v brskalniku je tvoja prijavna seja.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Komu so podatki dostopni</h2>
        <p className="text-slate-300">
          Podatki tečejo pri dveh ponudnikih: <strong>Supabase</strong> (baza in
          prijava, strežniki v EU) in <strong>Vercel</strong> (gostovanje
          strani). Potrditvena in ponastavitvena pošta gre prek{' '}
          <strong>Resend</strong>. Nikomur drugemu podatkov ne posredujemo in
          jih ne prodajamo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Statistika igralcev</h2>
        <p className="text-slate-300">
          Podatki o nogometaših (nastopi, goli, kartoni) so povzeti po javno
          objavljenih zapisnikih MNZ Gorenjska. Pozicije in asistence, ki jih
          zapisnik ne vsebuje, določi skupnost z glasovanjem — zato so lahko
          napačne. Če je kaj narobe, klikni igralca in nam sporoči.
        </p>
        <p className="text-slate-300">
          Grbi klubov so last posameznih klubov in so prikazani zgolj za
          prepoznavo ekipe. Klub, ki tega ne želi, naj nam piše in grb bomo
          odstranili.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Fotografije</h2>
        <p className="text-slate-300">
          Fotografija na naslovnici je delo Abigail Keenan in je objavljena na{' '}
          <a
            href="https://unsplash.com/photos/1a6deb1dec8d"
            target="_blank"
            rel="noreferrer"
            className="text-gnl-300 underline"
          >
            Unsplashu
          </a>{' '}
          pod njihovo licenco, ki dovoljuje prosto uporabo. Ne prikazuje
          igralcev 1. GNL.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Tvoje pravice</h2>
        <p className="text-slate-300">
          Kadarkoli lahko zahtevaš izbris računa in vseh svojih podatkov ali
          popravek prikaznega imena. Piši nam na{' '}
          <a href="mailto:info@slff.eu" className="text-gnl-300 underline">
            info@slff.eu
          </a>{' '}
          in to uredimo. Ob izbrisu izgine tudi tvoja ekipa z lestvice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Pravila igranja</h2>
        <p className="text-slate-300">
          En človek, en račun. Glasovanje o asistencah in pozicijah je
          namenjeno resničnim popravkom — namerno napačno glasovanje kvari igro
          vsem in lahko vodi do odstranitve računa. Točkovanje in cene se lahko
          med sezono spremenijo, če se izkaže, da je kaj krivično; take
          spremembe bomo objavili.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Brez jamstva</h2>
        <p className="text-slate-300">
          Stran teče, kakor teče. Trudimo se, da so podatki pravilni in da je
          dosegljiva, jamčiti pa tega ne moremo — zapisniki znajo zamujati,
          statistika pa vsebovati napake.
        </p>
      </section>
    </div>
  )
}
