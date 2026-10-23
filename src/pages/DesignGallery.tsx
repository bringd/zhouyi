import { useId, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Dice5,
  Feather,
  Menu,
  MoveUpRight,
  Orbit,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";
import { divination, getHexagramById } from "@/lib/divination";
import { getTodayHexagram } from "@/lib/daily";
import type { Hexagram } from "@/types";
import "@/styles/design-gallery.css";

const DIRECTIONS = [
  {
    id: "a",
    name: "青岚书院",
    label: "山水 · 阅读 · 松弛",
    en: "THE QUIET STUDIO",
  },
  {
    id: "b",
    name: "朱砂档案",
    label: "朱砂 · 书册 · 秩序",
    en: "THE BOOK OF CHANGE",
  },
  {
    id: "c",
    name: "夜航观象",
    label: "星图 · 仪式 · 探索",
    en: "AN ATLAS OF POSSIBILITY",
  },
] as const;
type Direction = (typeof DIRECTIONS)[number]["id"];
type Screen = "home" | "cast" | "result";
const SCREENS: { id: Screen; name: string }[] = [
  { id: "home", name: "首页" },
  { id: "cast", name: "三数起卦" },
  { id: "result", name: "结果页" },
];
const EXAMPLES = [
  { name: "事业", question: "面对新的工作机会，我该如何把握进退？" },
  { name: "关系", question: "在这段关系中，我可以怎样更好地沟通？" },
  { name: "成长", question: "面对当下的迷茫，我该从哪里开始调整？" },
];

function Glyph({
  hexagram,
  moving,
  className = "",
}: {
  hexagram: Hexagram;
  moving?: number;
  className?: string;
}) {
  return (
    <div
      className={"dg-glyph " + className}
      role="img"
      aria-label={
        hexagram.name + (moving ? "，动爻为第" + moving + "爻" : "卦象")
      }
    >
      {[...hexagram.yaoLines].reverse().map((line) => (
        <div
          className="dg-yao"
          data-moving={line.position === moving}
          key={line.position}
        >
          {line.type === "yang" ? (
            <span />
          ) : (
            <>
              <span />
              <i />
              <span />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Scene({ direction }: { direction: Direction }) {
  const uid = useId().replace(/:/g, "");
  if (direction === "b") {
    return (
      <div className="dg-scene dg-scene-print" aria-hidden="true">
        <div className="dg-print-ring">
          <span>易</span>
          <i>一阴一阳之谓道</i>
        </div>
        <span className="dg-print-side">观乎天文 · 以察时变</span>
        <span className="dg-print-edition">
          卷 壹<br />
          六十四象
        </span>
        <div className="dg-print-lines">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (direction === "c") {
    return (
      <div className="dg-scene dg-scene-stars" aria-hidden="true">
        <svg viewBox="0 0 600 600" fill="none">
          <defs>
            <radialGradient id={uid}>
              <stop stopColor="#94b7a6" stopOpacity=".16" />
              <stop offset="1" stopColor="#94b7a6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="300" cy="300" r="290" fill={"url(#" + uid + ")"} />
          <g stroke="currentColor">
            <circle cx="300" cy="300" r="230" opacity=".5" />
            <circle cx="300" cy="300" r="218" opacity=".2" />
            <circle
              cx="300"
              cy="300"
              r="157"
              strokeDasharray="2 9"
              opacity=".55"
            />
            <circle cx="300" cy="300" r="110" opacity=".3" />
            {Array.from({ length: 64 }, (_, i) => (
              <path
                key={i}
                d={i % 8 === 0 ? "M300 62v23" : "M300 68v10"}
                transform={"rotate(" + i * 5.625 + " 300 300)"}
                opacity={i % 8 === 0 ? ".9" : ".4"}
              />
            ))}
            <path
              d="M300 48v504M48 300h504M125 125l350 350M125 475l350-350"
              opacity=".13"
            />
            <path d="M179 190l204-35 80 189-195 112-89-266Z" opacity=".4" />
            <path d="M179 190l284 154M383 155L268 456" opacity=".2" />
          </g>
          {[
            [179, 190],
            [383, 155],
            [463, 344],
            [268, 456],
            [107, 387],
            [452, 111],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="3" fill="#e4d4a4" />
              <circle cx={cx} cy={cy} r="8" stroke="#e4d4a4" opacity=".25" />
            </g>
          ))}
          <text
            x="300"
            y="118"
            textAnchor="middle"
            fill="currentColor"
            fontSize="14"
            letterSpacing="6"
          >
            乾 · 天
          </text>
          <text
            x="300"
            y="502"
            textAnchor="middle"
            fill="currentColor"
            fontSize="14"
            letterSpacing="6"
          >
            坤 · 地
          </text>
        </svg>
        <div className="dg-star-center">
          <span>观</span>
          <small>LOOK WITHIN</small>
        </div>
        <span className="dg-chart-label">THE CELESTIAL ATLAS / 001</span>
      </div>
    );
  }
  return (
    <div className="dg-scene dg-scene-mountains" aria-hidden="true">
      <svg
        viewBox="0 0 700 560"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id={uid}
            x1="350"
            y1="0"
            x2="350"
            y2="560"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#e1ebe0" />
            <stop offset="1" stopColor="#edf0e4" />
          </linearGradient>
          <linearGradient
            id={uid + "mist"}
            x1="350"
            y1="310"
            x2="350"
            y2="560"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f4f4e9" stopOpacity="0" />
            <stop offset="1" stopColor="#f4f4e9" />
          </linearGradient>
        </defs>
        <path d="M0 0h700v560H0z" fill={"url(#" + uid + ")"} />
        <circle cx="455" cy="133" r="48" fill="#ddac84" opacity=".7" />
        <path
          d="M-30 376L112 226l65 57L316 89l126 184 70-62 220 211v153H-30Z"
          fill="#becdbb"
        />
        <path
          d="M-40 467L139 313l64 49 152-190 164 229 78-89 163 167v101H-40Z"
          fill="#8fae9b"
        />
        <path
          d="M257 281l98-109-20 89 30 3 18 57 19 20-25-10-41-55-50 34Z"
          fill="#dbe3d1"
          opacity=".6"
        />
        <path
          d="M-34 529L61 450l88 26 138-95 149 90 93-104 164 125 70 83H-34Z"
          fill="#597c6b"
        />
        <path
          d="M343 404c-86 15-74 53-19 63s52 27-26 42-49 31 20 51"
          stroke="#dce5d5"
          strokeWidth="13"
          opacity=".8"
        />
        <path d="M0 310h700v250H0z" fill={"url(#" + uid + "mist)"} />
        <g stroke="#516d5d" strokeWidth="1.5" opacity=".6">
          <path d="M507 173q8-9 16 0 7-8 15-2M548 153q6-7 12 0 7-6 13-1" />
        </g>
      </svg>
      <span className="dg-landscape-poem">
        山静日长
        <br />
        万物有时
      </span>
      <span className="dg-art-index">山水之间，照见自己。</span>
    </div>
  );
}

export default function DesignGallery() {
  const [params, setParams] = useSearchParams();
  const direction: Direction =
    params.get("direction") === "b"
      ? "b"
      : params.get("direction") === "c"
        ? "c"
        : "a";
  const screen: Screen =
    params.get("page") === "cast"
      ? "cast"
      : params.get("page") === "result"
        ? "result"
        : "home";
  const design = DIRECTIONS.find((item) => item.id === direction)!;
  const [question, setQuestion] = useState("");
  const [numbers, setNumbers] = useState(["", "", ""]);
  const [castNumbers, setCastNumbers] = useState<[number, number, number]>([
    129, 257, 601,
  ]);
  const [interpretationOpen, setInterpretationOpen] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dailyResult = getTodayHexagram();
  const daily = getHexagramById(dailyResult.mainHexagramId);
  const result = divination(...castNumbers);
  const main = getHexagramById(result.mainHexagramId);
  const changed = getHexagramById(result.changedHexagramId);
  const moving = main.yaoLines[result.movingLine - 1];
  const date = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const switchScreen = (next: Screen) => {
    setParams({ direction, page: next }, { preventScrollReset: true });
    setError("");
  };
  const handleCast = (event: FormEvent) => {
    event.preventDefault();
    if (numbers.some((value) => !/^[1-9]\d{2}$/.test(value))) {
      setError("请填入三个 100–999 的整数。");
      return;
    }
    setCastNumbers([
      Number(numbers[0]),
      Number(numbers[1]),
      Number(numbers[2]),
    ]);
    setInterpretationOpen(false);
    setSaved(false);
    switchScreen("result");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const selectRandom = () =>
    setNumbers(
      Array.from({ length: 3 }, () =>
        String(Math.floor(100 + Math.random() * 900)),
      ),
    );

  return (
    <div className="dg-lab">
      <Helmet>
        <title>易象阁 · 三套设计提案</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="dg-controls">
        <div className="dg-controls-intro">
          <Link to="/divination" aria-label="返回现有网站">
            <ArrowLeft size={17} />
          </Link>
          <span>
            易象阁 <b>设计提案</b>
          </span>
          <small>选择风格，再切换页面</small>
        </div>
        <div className="dg-directions" role="group" aria-label="设计方向">
          {DIRECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              data-direction={item.id}
              aria-pressed={direction === item.id}
              onClick={() =>
                setParams(
                  { direction: item.id, page: screen },
                  { preventScrollReset: true },
                )
              }
            >
              <i />
              <span>
                {item.id.toUpperCase()}
                <b>{item.name}</b>
              </span>
            </button>
          ))}
        </div>
        <div className="dg-screen-controls" role="group" aria-label="预览页面">
          {SCREENS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={screen === item.id}
              onClick={() => switchScreen(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className={"dg-site dg-theme-" + direction} data-screen={screen}>
        <header className="dg-header dg-wrap">
          <button
            type="button"
            className="dg-brand"
            onClick={() => switchScreen("home")}
            aria-label="易象阁 预览首页"
          >
            <span className="dg-seal">易</span>
            <span>
              <strong>易象阁</strong>
              <small>ORIX STUDIO</small>
            </span>
          </button>
          <nav aria-label="方案导航">
            <button
              type="button"
              aria-current={screen === "home" ? "page" : undefined}
              onClick={() => switchScreen("home")}
            >
              今日卦境
            </button>
            <Link to="/codex">六十四卦</Link>
            <button
              type="button"
              aria-current={
                screen === "cast" || screen === "result" ? "page" : undefined
              }
              onClick={() => switchScreen("cast")}
            >
              三数起卦
            </button>
            <Link to="/records">我的卦册</Link>
          </nav>
          <div className="dg-header-end">
            <span>
              {direction === "c" ? "天地有序，万物有时" : "观象 · 知时 · 明心"}
            </span>
            <button
              type="button"
              className="dg-menu"
              aria-label="切换到起卦页"
              onClick={() => switchScreen("cast")}
            >
              <Menu size={20} />
            </button>
            <span className="dg-header-dot" />
          </div>
        </header>

        <main>
          {screen === "home" && (
            <>
              <section className="dg-home-hero dg-wrap">
                <div className="dg-hero-copy">
                  <div className="dg-kicker">
                    <span />
                    {direction === "a"
                      ? "与古老的智慧，重新相遇"
                      : direction === "b"
                        ? "东方智慧的当代读本 · 第一卷"
                        : "一场向内的探索，现在开始"}
                  </div>
                  <h1>
                    {direction === "a" ? (
                      <>
                        慢下来，
                        <br />
                        读懂此刻的<span>自己。</span>
                      </>
                    ) : direction === "b" ? (
                      <>
                        万物皆有时。
                        <br />
                        <span>你，也有答案。</span>
                      </>
                    ) : (
                      <>
                        天地之间，
                        <br />
                        总有你的<span>坐标。</span>
                      </>
                    )}
                  </h1>
                  <p>
                    {direction === "a"
                      ? "借一卦之象，留一刻清明。让《周易》的智慧，成为日常里温柔而坚定的陪伴。"
                      : direction === "b"
                        ? "把纷繁的生活，翻成清晰的一页。从六十四种变化中，读出属于当下的启示。"
                        : "让三个数字，连接此刻的心绪。在六十四种可能中，寻找前行的微光。"}
                  </p>
                  <div className="dg-hero-actions">
                    <button
                      className="dg-primary"
                      type="button"
                      onClick={() => switchScreen("cast")}
                    >
                      {direction === "a"
                        ? "静心起一卦"
                        : direction === "b"
                          ? "翻开我的这一页"
                          : "开启一次观象"}
                      <ArrowUpRight size={18} />
                    </button>
                    <a className="dg-text-action" href="#dg-today">
                      遇见今日卦境 <ArrowDown size={15} />
                    </a>
                  </div>
                  <div className="dg-hero-meta">
                    <span>一事一问</span>
                    <span>一日一观</span>
                    <span>一念一新</span>
                  </div>
                </div>
                <Scene direction={direction} />
                {direction === "b" && (
                  <div className="dg-b-hero-footer">
                    <span>THE BOOK OF CHANGE</span>
                    <span>一部写了三千年，仍未写完的书。</span>
                    <span>01 — 64</span>
                  </div>
                )}
              </section>

              <div className="dg-home-lower dg-wrap">
                <section
                  className="dg-today"
                  id="dg-today"
                  aria-labelledby="dg-today-title"
                >
                  <div className="dg-section-top">
                    <span className="dg-overline">
                      <Sun size={15} /> DAILY READING
                    </span>
                    <span>{date}</span>
                  </div>
                  <div className="dg-today-layout">
                    <div className="dg-today-heading">
                      <h2 id="dg-today-title">今日卦境</h2>
                      <p>今日的答案，藏在变化里。</p>
                    </div>
                    <div className="dg-today-reading">
                      <span className="dg-overline">
                        第 {daily.number} 卦 /{" "}
                        {daily.keywords.slice(0, 2).join(" · ")}
                      </span>
                      <h3>{daily.name}</h3>
                      <p>{daily.modernInterpretation?.slice(0, 80)}</p>
                      <Link to={"/hexagram/" + daily.id}>
                        展开今日卦境 <ArrowRight size={16} />
                      </Link>
                    </div>
                    <div className="dg-daily-art">
                      <Glyph hexagram={daily} moving={dailyResult.movingLine} />
                      <span>观象，而后知时。</span>
                    </div>
                  </div>
                </section>
                <section className="dg-explore" aria-label="探索易象阁">
                  <span className="dg-overline">THE PRACTICE / 日常之易</span>
                  <h2>
                    从一卦，
                    <br />
                    走向更辽阔的自己。
                  </h2>
                  <Link to="/codex">
                    <span>
                      <BookOpen size={18} />
                      六十四卦图鉴
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                  <Link to="/records">
                    <span>
                      <Feather size={18} />
                      把领悟，写进卦册
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                </section>
              </div>
              <div className="dg-home-note dg-wrap">
                <span>“穷则变，变则通，通则久。”</span>
                <p>不求预知一切，只为更好地回应当下。</p>
              </div>
            </>
          )}

          {screen === "cast" && (
            <div className="dg-cast-page dg-wrap">
              <div className="dg-breadcrumb">
                <button type="button" onClick={() => switchScreen("home")}>
                  首页
                </button>
                <ChevronRight size={13} />
                <span>三数起卦</span>
              </div>
              <div className="dg-cast-layout">
                <aside className="dg-cast-intro">
                  <span className="dg-overline">A MOMENT FOR YOURSELF</span>
                  <h1>
                    {direction === "c" ? (
                      <>
                        向内看，
                        <br />
                        然后<span>向前走。</span>
                      </>
                    ) : direction === "b" ? (
                      <>
                        有问，
                        <br />
                        便有<span>新的开始。</span>
                      </>
                    ) : (
                      <>
                        把心事放下，
                        <br />
                        让答案<span>浮现。</span>
                      </>
                    )}
                  </h1>
                  <p>
                    先留一刻空白。想一件真正关心的事，让三个随心而来的数字，为思考打开另一扇门。
                  </p>
                  <Scene direction={direction} />
                  <div className="dg-cast-caption">
                    <span>01 静心</span>
                    <span>02 问事</span>
                    <span>03 取数</span>
                  </div>
                </aside>
                <form className="dg-cast-form" onSubmit={handleCast}>
                  <div className="dg-form-title">
                    <span className="dg-overline">
                      THREE NUMBERS, ONE INSIGHT
                    </span>
                    <h2>三数起卦</h2>
                    <p>问于心，发于数。</p>
                  </div>
                  <div className="dg-field-title">
                    <label htmlFor="dg-question">
                      <span>01</span> 此刻，你想问什么？
                    </label>
                    <small>选填</small>
                  </div>
                  <textarea
                    id="dg-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={200}
                    placeholder="例如：面对新的机会，我该如何把握进退？"
                    rows={3}
                  />
                  <div className="dg-question-helpers">
                    <div>
                      {EXAMPLES.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          aria-pressed={question === item.question}
                          onClick={() => setQuestion(item.question)}
                        >
                          {item.name}
                          <Plus size={11} />
                        </button>
                      ))}
                    </div>
                    <span>{question.length}/200</span>
                  </div>
                  <div className="dg-field-title">
                    <span>
                      <b>02</b> 随心，定下三个数字
                    </span>
                    <small>100—999</small>
                  </div>
                  <div className="dg-number-inputs">
                    {["第一数", "第二数", "第三数"].map((name, i) => (
                      <label key={name}>
                        <span>{name}</span>
                        <input
                          aria-label={name}
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={3}
                          value={numbers[i]}
                          placeholder="—"
                          onChange={(e) =>
                            setNumbers((current) =>
                              current.map((value, index) =>
                                index === i
                                  ? e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 3)
                                  : value,
                              ),
                            )
                          }
                        />
                        <small>
                          {["下卦 · 内在", "上卦 · 外在", "动爻 · 变化"][i]}
                        </small>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="dg-random"
                    onClick={selectRandom}
                  >
                    <Dice5 size={16} /> 随机取三个数
                  </button>
                  {error && (
                    <p className="dg-form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button type="submit" className="dg-primary dg-cast-submit">
                    三数已定，启卦
                    <ArrowRight size={18} />
                  </button>
                  <p className="dg-form-note">
                    设计预览：沿用真实起卦算法，不保存记录。
                  </p>
                </form>
              </div>
            </div>
          )}

          {screen === "result" && (
            <div className="dg-result-page dg-wrap">
              <div className="dg-breadcrumb">
                <button type="button" onClick={() => switchScreen("cast")}>
                  三数起卦
                </button>
                <ChevronRight size={13} />
                <span>卦象已成</span>
              </div>
              <header className="dg-result-heading">
                <div>
                  <span className="dg-overline">A NEW PERSPECTIVE</span>
                  <h1>
                    {direction === "a"
                      ? "万象流转，自有回响。"
                      : direction === "b"
                        ? "这一页，写给此刻的你。"
                        : "你的坐标，已在星图中点亮。"}
                  </h1>
                </div>
                <span className="dg-result-tag">
                  <Check size={14} /> 卦象已成
                </span>
              </header>
              <div className="dg-question-banner">
                <span>此刻所问</span>
                <p>
                  {question.trim() || "面对新的工作机会，我该如何把握进退？"}
                </p>
                <small>{castNumbers.join(" · ")}</small>
              </div>
              <div className="dg-result-layout">
                <div className="dg-result-main">
                  <section className="dg-reading-pair" aria-label="本卦与变卦">
                    {[
                      { h: main, name: "本卦", en: "THE PRESENT" },
                      { h: changed, name: "变卦", en: "THE POSSIBILITY" },
                    ].map(({ h, name, en }, i) => (
                      <article
                        key={name}
                        className={"dg-result-card dg-result-card-" + i}
                      >
                        <div className="dg-result-card-top">
                          <span>{name}</span>
                          <span>NO. {String(h.number).padStart(2, "0")}</span>
                        </div>
                        <div className="dg-result-art">
                          <span
                            className="dg-result-watermark"
                            aria-hidden="true"
                          >
                            {h.shortName}
                          </span>
                          <Glyph hexagram={h} moving={result.movingLine} />
                        </div>
                        <span className="dg-overline">{en}</span>
                        <h2>{h.name}</h2>
                        <p>{h.judgement}</p>
                        <Link to={"/hexagram/" + h.id}>
                          读卦辞原文 <ArrowUpRight size={15} />
                        </Link>
                      </article>
                    ))}
                    <span className="dg-pair-arrow" aria-hidden="true">
                      <ArrowRight size={19} />
                    </span>
                  </section>
                  <section className="dg-moving-reading">
                    <span className="dg-overline">
                      THE TURNING POINT / 第 {result.movingLine} 爻动
                    </span>
                    <h2>{moving.originalText}</h2>
                    <p>{moving.modernMeaning || moving.explanation}</p>
                  </section>
                  <section className="dg-interpretation">
                    <div>
                      <span className="dg-overline">
                        <Sparkles size={15} /> ANOTHER PERSPECTIVE
                      </span>
                      <h2>把卦象，读回生活。</h2>
                    </div>
                    <p>先读懂卦象的提醒，再回到你真正关心的问题。</p>
                    {interpretationOpen ? (
                      <div className="dg-sample-reading">
                        <span>示例解读 · 卦象资料节选</span>
                        <p>{main.modernInterpretation}</p>
                        <p>
                          关于这次变化：
                          {changed.modernInterpretation?.slice(0, 180)}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="dg-text-action"
                        onClick={() => setInterpretationOpen(true)}
                      >
                        阅读示例解读 <MoveUpRight size={16} />
                      </button>
                    )}
                  </section>
                </div>
                <aside className="dg-result-sidebar">
                  <Compass size={27} strokeWidth={1.3} />
                  <span className="dg-overline">TAKE IT WITH YOU</span>
                  <h2>
                    让今天的领悟，
                    <br />
                    成为明天的线索。
                  </h2>
                  <p>
                    答案的意义，不止于当下。给自己一点时间，看看变化如何发生。
                  </p>
                  <button
                    type="button"
                    className="dg-primary"
                    onClick={() => setSaved(true)}
                  >
                    {saved ? (
                      <>
                        <Check size={16} /> 已选择此版式
                      </>
                    ) : (
                      <>
                        我喜欢这个版式 <ArrowUpRight size={16} />
                      </>
                    )}
                  </button>
                  <p className="dg-choice-status" role="status">
                    {saved
                      ? "已在本次预览中标记，你可以告诉我方案 " +
                        direction.toUpperCase() +
                        "。"
                      : "仅标记本次预览，不写入正式卦册。"}
                  </p>
                  <button
                    className="dg-sidebar-back"
                    type="button"
                    onClick={() => switchScreen("cast")}
                  >
                    <Orbit size={16} /> 换一个问题，重新起卦
                  </button>
                  <div className="dg-sidebar-seal">
                    易
                    <span>
                      一卦一境
                      <br />
                      一念一新
                    </span>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </main>

        <footer className="dg-footer dg-wrap">
          <span>
            易象阁 <i>ORIX STUDIO</i>
          </span>
          <p>周易文化研究 · 自我观照之所</p>
          <span>
            观象知变，从容而行。 <ArrowUpRight size={14} />
          </span>
        </footer>
      </div>
      <div className="dg-proposal-note">
        <span>
          <i className={"dg-swatch-" + direction} />
          方案 {direction.toUpperCase()} · {design.name}
        </span>
        <span>{design.label}</span>
        <p>设计预览 · 起卦沿用真实算法 · 解读为示例内容</p>
        <Link to="/divination">
          返回现有页面 <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
