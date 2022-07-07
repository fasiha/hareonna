function Intro() {
  return (
    <details id="background">
      <summary>
        Click here for a little background behind this little app
      </summary>
      <p>
        I had often opened the Wikipedia page for various cities and inspected
        the table of monthly temperature lows and highs to get a sense of what
        the climate was like. This app is a generalization of that.
      </p>
      <p>
        The details are on{" "}
        <a href="https://github.com/fasiha/hareonna/">GitHub</a> but in a
        nutshell, I grabbed all ~13'500 global weather stations from the Global
        Historical Climatology Network daily (
        <a href="https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily">
          GHCNd
        </a>
        ) dataset that had temperature data over the last three years and looked
        at the temperature <em>percentile</em>s. I think percentiles are a more
        compact set of numbers to understand compared to the monthly averages
        Wikipedia has: the table below will have the specifics but a
        50-percentile low means that half the days in the last three years were
        less than that value. A 10-percentile low means ~5 weeks of a year have
        lows lower than this, and a 90-percentile low means ~5 weeks per year
        have lows <em>higher</em> than this.
      </p>
      <p>So something I enjoy doing is,</p>
      <ol>
        <li>
          first select a weather station near my home (you can either search
          OpenStreetMap or just zoom around the map) and clicking{" "}
          <button>Pick</button>.
        </li>
        <li>
          Then find some <em>other</em> faraway place and click{" "}
          <button>Find similar</button>.
        </li>
      </ol>
      <p>
        That should get you started! And sorry, as you can tell from the buttons
        and the widgets and the cobbled-together nature of everything, this was
        thrown together in literally a weekend, but I hope you like it!
      </p>
      <p>
        (You might enjoy reading more about this app in my{" "}
        <a href="https://fasiha.github.io/post/hareonna-global-weather/">
          blog post
        </a>{" "}
        about it. The name comes from Makoto Shinkai's film,{" "}
        <em>Weathering with You</em>, originally 『天気の子』, "weather child",
        where the eponymous child is called 「晴れ女」,{" "}
        <a href="https://jisho.org/search/晴れ女">"hareonna"</a>: a woman who
        brings good weather.)
      </p>
      <p
        onClick={() => {
          const e = document.querySelector("details#background");
          if (e) (e as any).open = false;
        }}
      >
        ▲ Close background
      </p>
    </details>
  );
}
export default Intro;
