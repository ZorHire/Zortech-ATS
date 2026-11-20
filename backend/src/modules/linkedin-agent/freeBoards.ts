/**
 * Free job boards ZorHire can post to through the Chrome extension. The extension keeps
 * its own copy of the page-matching rules (extension/boards.js); keep keys in sync.
 * URLs were checked on 20 Nov 2026. Boards change their sites: if one stops working,
 * update the URL here and in extension/boards.js.
 */
export interface FreeBoard {
  key: string;
  name: string;
  postUrl: string;
  loginUrl: string;
  signupUrl: string;
  bestFor: string;
  freeTier: string;
  /** Employment types the board accepts for free. */
  accepts: ("full_time" | "part_time" | "contract" | "internship")[];
  /** Boards aimed at freshers: not suggested when the job needs more experience than this. */
  maxExperience?: number;
}

export const FREE_BOARDS: FreeBoard[] = [
  {
    key: "linkedin",
    name: "LinkedIn Jobs",
    postUrl: "https://www.linkedin.com/talent/post-a-job",
    loginUrl: "https://www.linkedin.com/login",
    signupUrl: "https://www.linkedin.com/signup",
    bestFor: "Experienced professionals, all IT roles",
    freeTier: "One free job post at a time; LinkedIn offers paid promotion but it's optional.",
    accepts: ["full_time", "part_time", "contract", "internship"],
  },
  {
    key: "indeed",
    name: "Indeed",
    postUrl: "https://employers.indeed.com/p/post-job",
    loginUrl: "https://employers.indeed.com/p/post-job",
    signupUrl: "https://employers.indeed.com/p/post-job",
    bestFor: "Wide reach across India and abroad",
    freeTier: "Free organic posts; sponsoring is optional (choose the free option when asked).",
    accepts: ["full_time", "part_time", "contract", "internship"],
  },
  {
    key: "naukri",
    name: "Naukri (free job posting)",
    postUrl: "https://www.naukri.com/recruit/free-job-posting",
    loginUrl: "https://www.naukri.com/recruit/login",
    signupUrl: "https://www.naukri.com/recruit/free-job-posting",
    bestFor: "India's largest job site, mid-level IT roles",
    freeTier: "Free job posting with limited visibility; Hot Vacancy and Resdex are paid.",
    accepts: ["full_time", "part_time", "contract"],
  },
  {
    key: "unstop",
    name: "Unstop",
    postUrl: "https://unstop.com/hire",
    loginUrl: "https://unstop.com/hire",
    signupUrl: "https://unstop.com/hire",
    bestFor: "Freshers, campus hiring, internships",
    freeTier: "Free job and internship listings.",
    accepts: ["full_time", "internship"],
    maxExperience: 3,
  },
  {
    key: "hiremee",
    name: "HireMee",
    postUrl: "https://hiremee.co.in/corporate",
    loginUrl: "https://hiremee.co.in/corporate",
    signupUrl: "https://hiremee.co.in/corporate",
    bestFor: "Assessed freshers and entry-level candidates",
    freeTier: "Free corporate account for posting jobs to assessed candidates.",
    accepts: ["full_time", "internship"],
    maxExperience: 2,
  },
  {
    key: "internshala",
    name: "Internshala",
    postUrl: "https://internshala.com/employer/",
    loginUrl: "https://internshala.com/login/employer",
    signupUrl: "https://internshala.com/employer/",
    bestFor: "Internships and fresher jobs (0-2 years)",
    freeTier: "Free internship and fresher job posts.",
    accepts: ["full_time", "internship"],
    maxExperience: 2,
  },
  {
    key: "apna",
    name: "apna",
    postUrl: "https://employer.apna.co/",
    loginUrl: "https://employer.apna.co/",
    signupUrl: "https://employer.apna.co/",
    bestFor: "Entry-level, support and operations roles",
    freeTier: "Free basic job posts (limited per month).",
    accepts: ["full_time", "part_time", "contract", "internship"],
    maxExperience: 5,
  },
  {
    key: "cutshort",
    name: "Cutshort",
    postUrl: "https://cutshort.io/hire",
    loginUrl: "https://cutshort.io/hire",
    signupUrl: "https://cutshort.io/hire",
    bestFor: "Tech roles at startups and product companies",
    freeTier: "Free job posts; AI sourcing features are paid.",
    accepts: ["full_time", "contract", "internship"],
  },
  {
    key: "wellfound",
    name: "Wellfound (AngelList Talent)",
    postUrl: "https://wellfound.com/recruit/overview",
    loginUrl: "https://wellfound.com/recruit/overview",
    signupUrl: "https://wellfound.com/recruit/overview",
    bestFor: "Startup and remote tech roles",
    freeTier: "Free job posts for startups.",
    accepts: ["full_time", "contract", "internship"],
  },
];

export const FREE_BOARD_KEYS = new Set(FREE_BOARDS.map((b) => b.key));
