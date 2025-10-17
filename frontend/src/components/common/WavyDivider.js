// common/WavyDivider.js
export default function WavyDivider({ className = "", flip = false }) {
  return (
    <div className={`${className} overflow-hidden leading-[0]`}>
      <svg
        className={`w-full h-40 ${flip ? "rotate-180" : ""}`}
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg">
        <path
          fill="currentColor"
          d="M0,224L30,202.7C60,181,120,139,180,117.3C240,96,300,96,360,122.7C420,149,480,203,540,224C600,245,660,235,720,218.7C780,203,840,181,900,176C960,171,1020,181,1080,208C1140,235,1200,277,1260,272C1320,267,1380,213,1410,186.7L1440,160L1440,320L0,320Z"
        />
      </svg>
    </div>
  );
}
