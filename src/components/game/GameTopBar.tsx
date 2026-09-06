import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { playSfx } from "../../game/sfx";
import { ScoreTicker } from "./ScoreTicker";
import { ComboMeter } from "./ComboMeter";
import { TimerBar } from "./TimerBar";
import { Icon } from "../Icon";

interface Props {
  /** samlet poengsum så langt */
  points: number;
  /** riktige på rad akkurat nå */
  streak: number;
  /** antall faktisk riktige (oppgitt teller ikke) */
  correctCount: number;
  /** antall fullførte mål (inkl. oppgitt) — styrer fremdrift */
  done: number;
  total: number;
  /** hvor mange steder som fortsatt står igjen i køen */
  remaining: number;
  mistakes: number;
  /** når nåværende spørsmål ble vist — klokka regner ut resten selv */
  questionStartedAt: number;
  /** hele tidsrammen per spørsmål; 0 = ingen klokke */
  questionMs: number;
  /** klokka går bare mens runden faktisk spilles */
  running: boolean;
  onTimeout: () => void;
}

/**
 * Resultattavla. Poengsummen står øverst og størst fordi den er det du jager;
 * combo, treff og feil ligger på linja under som støttetall.
 */
export const GameTopBar = memo(function GameTopBar({
  points,
  streak,
  correctCount,
  done,
  total,
  remaining,
  mistakes,
  questionStartedAt,
  questionMs,
  running,
  onTimeout,
}: Props) {
  const { t } = useTranslation();
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <header className="shrink-0 px-2.5 pt-0.5 sm:px-4 sm:pt-1">
      <div className="panel mx-auto flex max-w-6xl items-center gap-3 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2">
        {/*
          Kronometeret står montert på siden av panelet, ikke inne i den nedre
          raden. Skiva er femtito piksler høy og raden den lå i var laget for
          tjue: den presset panelet ut av fasong og lå halvveis nedi kanten.
          Her har den sin egen plass ved siden av begge radene, slik et
          instrument sitter i en ramme.
        */}
        {questionMs > 0 && (
          <QuestionClock
            questionStartedAt={questionStartedAt}
            questionMs={questionMs}
            running={running}
            onTimeout={onTimeout}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="stat-label">{t("result.score")}</span>
              <ScoreTicker
                value={points}
                className="numeric text-lg font-bold leading-none sm:text-xl"
              />
            </div>

            <div className="flex flex-col items-end gap-1">
              <ComboMeter streak={streak} />
              <dl className="flex items-center gap-3 text-xs font-bold">
                <div
                  className="flex items-center gap-1"
                  style={{ color: "var(--success)" }}
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                  <dt className="sr-only">{t("hud.correct")}</dt>
                  <dd className="numeric">
                    {correctCount}/{total}
                  </dd>
                </div>
                <div
                  className="flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                  <dt className="sr-only">{t("hud.mistakesLabel")}</dt>
                  <dd className="numeric">{mistakes}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2">
            {/* «7 igjen» — Seterras tydeligste enkeltgrep: du vet alltid
              hvor langt det er igjen, ikke bare hvor langt du har kommet */}
            <span
              className="numeric shrink-0 text-xs font-bold"
              style={{ color: "var(--text-subtle)" }}
            >
              {t("hud.remaining", { left: remaining, total })}
            </span>

            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--map-idle)" }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("hud.done")}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, var(--accent), var(--gold))",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});

/**
 * Klokka for ett spørsmål.
 *
 * Den ligger her, og ikke i `GameScreen`, fordi den tikker ti ganger i sekundet.
 * Fra spillskjermen ville hvert tikk ha gitt en ny rendring av hele
 * spillgrenen — toppbjelke, HUD og kartprops — bare for å flytte en stripe
 * noen piksler. Nå er det denne komponenten alene som blir rendret på nytt,
 * og resten av spillet står stille til noe faktisk skjer.
 */
function QuestionClock({
  questionStartedAt,
  questionMs,
  running,
  onTimeout,
}: {
  questionStartedAt: number;
  questionMs: number;
  running: boolean;
  onTimeout: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(questionMs);

  useEffect(() => {
    if (!questionMs || !running) return;
    const deadline = questionStartedAt + questionMs;
    let warned = false;

    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemainingMs(left);
      if (left <= 3000 && left > 0 && !warned) {
        warned = true;
        playSfx("tick");
      }
      if (left === 0) onTimeout();
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [questionStartedAt, questionMs, running, onTimeout]);

  return <TimerBar remainingMs={remainingMs} totalMs={questionMs} />;
}
