import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  useListProjects,
  useGetImpactStats,
  useGetDonationSummary,
  useListDonations,
  type Donation,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Heart,
  LogOut,
  Download,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Globe,
  Users,
  BarChart3,
  ArrowRight,
  FileText,
  CheckCircle2,
  Shield,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

type DashboardTab = "overview" | "donations" | "projects" | "profile" | "admin";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background border border-border p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
          {label}
        </span>
        <Icon size={18} className="text-primary" />
      </div>
      <div className="font-serif text-3xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function formatMoney(amount: number): string {
  return `EUR ${amount.toLocaleString()}`;
}

function generateReport(user: { name: string; email: string; memberSince: string; role: string }, donations: Donation[], impact: { projectsCompleted: number; beneficiaries: number; countriesReached: number } | undefined) {
  const totalDonated = donations.reduce((sum, donation) => sum + donation.amount, 0);
  return [
    "====================================================",
    "          PAPI FOUNDATION MEMBER REPORT",
    "====================================================",
    "",
    `Member Name   : ${user.name}`,
    `Email         : ${user.email}`,
    `Member Since  : ${user.memberSince}`,
    `Access Level  : ${user.role}`,
    `Report Date   : ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    "",
    "----------------------------------------------------",
    "  CONTRIBUTION SUMMARY",
    "----------------------------------------------------",
    `Total Donated : ${formatMoney(totalDonated)}`,
    `Transactions  : ${donations.length}`,
    "",
    "----------------------------------------------------",
    "  FOUNDATION IMPACT",
    "----------------------------------------------------",
    `Projects Completed    : ${impact?.projectsCompleted ?? 0}`,
    `Lives Impacted        : ${(impact?.beneficiaries ?? 0).toLocaleString()}+`,
    `Countries Reached     : ${impact?.countriesReached ?? 0}`,
    "",
    "====================================================",
    "  PAPI FOUNDATION",
    "====================================================",
  ].join("\n");
}

export default function Dashboard() {
  const { user, isLoaded, logout, followProject, unfollowProject, isFollowing, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  const { data: projects } = useListProjects();
  const { data: impact } = useGetImpactStats();
  const { data: summary } = useGetDonationSummary();
  const { data: donations } = useListDonations({
    query: { queryKey: ["donations"], enabled: isAdmin },
  });

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeDonations: Donation[] = isAdmin && Array.isArray(donations) ? donations : [];
  const followedProjects = safeProjects.filter((project) => isFollowing(project.id));
  const normalizedUserName = user?.name?.toLowerCase() ?? "";
  const normalizedEmailPrefix = user?.email?.split("@")[0]?.toLowerCase() ?? "";
  const ownDonations = safeDonations.filter(
    (donation) =>
      donation.donorName.toLowerCase() === normalizedUserName ||
      donation.donorName.toLowerCase().includes(normalizedEmailPrefix),
  );
  const donationRows = isAdmin ? safeDonations : ownDonations;
  const totalDonated = donationRows.reduce((sum, donation) => sum + donation.amount, 0);

  if (!isLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (!user) {
    navigate("/sign-in");
    return null;
  }

  const tabs: Array<{ key: DashboardTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "donations", label: "Donations" },
    { key: "projects", label: "My Projects" },
    { key: "profile", label: "Profile" },
  ];
  if (isAdmin) {
    tabs.push({ key: "admin", label: "Admin" });
  }

  const handleDownloadReport = () => {
    const content = generateReport(user, donationRows, impact);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Papi-Foundation-Report-${user.name.replace(/\s+/g, "-")}-${new Date().getFullYear()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const totalRecurring = donationRows.filter((donation) => donation.type === "monthly").length;

  return (
    <div
      className="min-h-screen py-10"
      style={{ background: "linear-gradient(180deg, #F5F0E5 0%, #FAFAF6 200px)" }}
    >
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8 flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-secondary flex items-center justify-center shrink-0">
              <span className="font-serif text-2xl font-bold text-secondary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-serif text-2xl text-foreground">
                Welcome back, {user.name.split(" ")[0]}
              </div>
              <div className="text-xs text-muted-foreground tracking-wide mt-0.5">
                Member since{" "}
                {new Date(user.memberSince).toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}{" "}
                &middot; {user.memberType}
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] tracking-[0.2em] uppercase font-semibold ${
                    isAdmin
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {isAdmin ? "Admin access" : "Member access"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[11px] tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors"
            >
              <Download size={13} />
              Impact Report
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 border border-border text-muted-foreground px-5 py-2.5 text-[11px] tracking-widest uppercase font-bold hover:border-destructive hover:text-destructive transition-colors"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </motion.div>

        {isAdmin && (
          <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-3">
            <Shield size={18} className="text-primary shrink-0" />
            <div>
              <div className="text-xs tracking-[0.22em] uppercase font-semibold text-primary">
                Administrative access enabled
              </div>
              <div className="text-sm text-muted-foreground">
                You can review donation records and operational activity from this dashboard.
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3.5 text-[11px] tracking-widest uppercase font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label={isAdmin ? "Donation Ledger" : "Donation Access"}
                value={isAdmin ? formatMoney(totalDonated) : "Private"}
                sub={isAdmin ? `${donationRows.length} records` : "Hidden from member view"}
                icon={Heart}
              />
              <StatCard
                label="Projects Followed"
                value={`${followedProjects.length}`}
                sub="Use the Projects tab to manage"
                icon={Bookmark}
              />
              <StatCard
                label="Lives Impacted"
                value={`${(impact?.beneficiaries ?? 0).toLocaleString()}+`}
                sub="Foundation-wide"
                icon={Users}
              />
              <StatCard
                label="Countries Reached"
                value={`${impact?.countriesReached ?? 0}`}
                sub="Active programs"
                icon={Globe}
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-background border border-border p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl">Impact Summary</h2>
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-primary font-bold hover:underline"
                  >
                    <FileText size={12} />
                    Download Report
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Clean water provided to", value: "2,000+ families" },
                    { label: "Children enrolled in education", value: "500+ students" },
                    { label: "Healthcare patients served", value: "8,500+ people" },
                    { label: "Villages electrified with solar", value: "8 communities" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-4 p-3.5 bg-card border border-border">
                      <CheckCircle2 size={16} className="text-primary" />
                      <div className="flex-1 text-sm">{item.label}</div>
                      <div className="font-semibold text-sm text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                  These are the collective outcomes of the foundation programs you are connected to through your membership.
                </p>
              </div>

              <div className="bg-secondary text-secondary-foreground p-6 space-y-5 flex flex-col">
                <div className="text-[10px] tracking-widest uppercase text-primary font-semibold">
                  Foundation Wide
                </div>
                <h2 className="font-serif text-xl">Overall Progress</h2>
                {[
                  { label: "Total raised", value: summary ? formatMoney(summary.totalRaised) : "Loading" },
                  { label: "Total donors", value: (summary?.totalDonors ?? 0).toLocaleString() },
                  { label: "Monthly recurring", value: formatMoney(summary?.monthlyRecurring ?? 0) },
                  { label: "Projects completed", value: `${impact?.projectsCompleted ?? 0}` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-secondary-foreground/10 pb-3 last:border-0 last:pb-0">
                    <span className="text-secondary-foreground/70 text-sm">{row.label}</span>
                    <span className="font-bold text-primary font-serif text-lg">{row.value}</span>
                  </div>
                ))}
                <Link
                  href="/donate"
                  className="mt-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 text-[11px] tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors"
                >
                  Donate Again <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {activeTab === "donations" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="font-serif text-2xl">Donation History</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {isAdmin
                    ? "You can review the live donation ledger here."
                    : "Donation records are restricted in this deployment. Use the public donor wall for live updates."}
                </p>
              </div>
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[11px] tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors"
              >
                <Download size={13} />
                Download Report
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-background border border-border p-5 text-center space-y-1">
                <div className="font-serif text-2xl font-bold text-primary">{formatMoney(totalDonated)}</div>
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Total Given</div>
              </div>
              <div className="bg-background border border-border p-5 text-center space-y-1">
                <div className="font-serif text-2xl font-bold text-primary">{donationRows.length}</div>
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Contributions</div>
              </div>
              <div className="bg-background border border-border p-5 text-center space-y-1">
                <div className="font-serif text-2xl font-bold text-primary">{totalRecurring}</div>
                <div className="text-[10px] tracking-widest uppercase text-muted-foreground">Recurring</div>
              </div>
            </div>

            {donationRows.length === 0 ? (
              <div className="bg-background border border-border p-12 text-center space-y-4">
                <BarChart3 size={40} className="text-primary/20 mx-auto" />
                <h3 className="font-serif text-xl">
                  {isAdmin ? "No donations yet" : "Donation history is private"}
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {isAdmin
                    ? "Your donation history will appear here once the first contribution is recorded."
                    : "Your donation history will appear here once you make your first contribution."}
                </p>
                <Link
                  href="/donate"
                  className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-8 py-3.5 text-[11px] tracking-widest uppercase font-bold hover:bg-secondary/90 transition-colors"
                >
                  {isAdmin ? "Open Donation Checkout" : "Make Your First Donation"} <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="bg-background border border-border overflow-hidden">
                <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-muted border-b border-border text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                  <span className="col-span-2">Donor</span>
                  <span>Amount</span>
                  <span>Type</span>
                  <span>Date</span>
                </div>
                <div className="divide-y divide-border">
                  {donationRows.map((donation, index) => (
                    <motion.div
                      key={donation.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.04 }}
                      className="grid grid-cols-5 gap-4 px-5 py-4 items-center hover:bg-card/50 transition-colors"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {donation.donorName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {donation.isAnonymous ? "Anonymous" : donation.donorName}
                          </div>
                          {donation.message && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                              "{donation.message}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-primary">{formatMoney(donation.amount)}</div>
                      <div>
                        <span
                          className={`text-[9px] tracking-widest uppercase px-2 py-0.5 font-bold ${
                            donation.type === "monthly"
                              ? "bg-secondary/20 text-secondary"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {donation.type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(donation.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card border border-border p-5 text-sm text-muted-foreground text-center">
              Donation records are managed separately from the public member dashboard.{" "}
              <Link href="/donate" className="text-primary font-semibold hover:underline">
                View the public donor wall
              </Link>
              .
            </div>
          </div>
        )}

        {activeTab === "projects" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl">My Projects</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Follow projects to track their progress and receive updates.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {safeProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={`bg-background border overflow-hidden hover:shadow-md transition-all ${
                    isFollowing(project.id) ? "border-primary/50" : "border-border"
                  }`}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-foreground/10" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span
                        className={`text-[9px] tracking-widest uppercase px-2 py-0.5 font-bold backdrop-blur-sm ${
                          project.status === "completed"
                            ? "bg-green-600/90 text-white"
                            : project.status === "ongoing"
                              ? "bg-primary/90 text-primary-foreground"
                              : "bg-secondary/90 text-secondary-foreground"
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>
                    {isFollowing(project.id) && (
                      <div className="absolute top-3 left-3">
                        <div className="bg-primary text-primary-foreground text-[9px] tracking-widest uppercase px-2 py-0.5 font-bold">
                          Following
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">
                          {project.country} · {project.category}
                        </div>
                        <h3 className="font-serif text-base leading-snug">{project.title}</h3>
                      </div>
                      <button
                        onClick={() =>
                          isFollowing(project.id) ? unfollowProject(project.id) : followProject(project.id)
                        }
                        className={`shrink-0 p-2 border transition-colors ${
                          isFollowing(project.id)
                            ? "border-primary text-primary bg-primary/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                        }`}
                        title={isFollowing(project.id) ? "Unfollow project" : "Follow project"}
                      >
                        {isFollowing(project.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{formatMoney(project.raisedAmount ?? 0)} raised</span>
                        <span className="font-semibold text-foreground">{project.progressPercent ?? 0}%</span>
                      </div>
                      <div className="h-1.5 bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progressPercent ?? 0}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Goal: {formatMoney(project.goalAmount)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {project.beneficiaries ? (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users size={11} className="text-primary" />
                          {project.beneficiaries.toLocaleString()} beneficiaries
                        </div>
                      ) : (
                        <span />
                      )}
                      <Link
                        href={`/projects/${project.id}`}
                        className="ml-auto text-[10px] tracking-widest uppercase font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        View <ChevronRight size={11} />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {followedProjects.length > 0 && (
              <div className="bg-card border border-border p-5 text-sm text-center">
                You are following <strong className="text-foreground">{followedProjects.length}</strong>{" "}
                project{followedProjects.length !== 1 ? "s" : ""}. We will notify you of major milestones and updates.
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6 max-w-xl">
            <div>
              <h2 className="font-serif text-2xl">My Profile</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Your membership details and account information.
              </p>
            </div>

            <div className="bg-background border border-border p-8 space-y-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-secondary flex items-center justify-center shrink-0">
                  <span className="font-serif text-4xl font-bold text-secondary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-2xl">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-[10px] tracking-widest uppercase text-primary font-semibold mt-1">
                    {user.memberType} Member
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                {[
                  { label: "Full Name", value: user.name },
                  { label: "Email Address", value: user.email },
                  { label: "Member Type", value: user.memberType.charAt(0).toUpperCase() + user.memberType.slice(1) },
                  { label: "Member Since", value: new Date(user.memberSince).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
                  { label: "Access Level", value: isAdmin ? "Admin" : "Member" },
                  { label: "Projects Followed", value: `${followedProjects.length} project${followedProjects.length !== 1 ? "s" : ""}` },
                  { label: "Total Donated", value: formatMoney(totalDonated) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <span className="text-xs tracking-widest uppercase text-muted-foreground font-semibold">{row.label}</span>
                    <span className="text-sm font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-secondary text-secondary-foreground p-6 space-y-4">
              <h3 className="font-serif text-xl">Your Membership Benefits</h3>
              {[
                "Access to member-only impact reports",
                "Project following and progress tracking",
                "Donation history and tax records",
                "Priority invitations to Foundation events",
                "Monthly newsletter with field updates",
                "Direct line to the Foundation team",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                  <span className="text-secondary-foreground/80">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownloadReport}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 text-[11px] tracking-widest uppercase font-bold hover:bg-primary/90 transition-colors"
              >
                <Download size={14} />
                Download Full Impact Report
              </button>
              <Link
                href="/donate"
                className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-4 text-[11px] tracking-widest uppercase font-bold hover:bg-secondary/90 transition-colors"
              >
                <Heart size={14} />
                Make Another Donation
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 border border-border text-muted-foreground py-3.5 text-[11px] tracking-widest uppercase font-bold hover:border-destructive hover:text-destructive transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {activeTab === "admin" && isAdmin && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className="text-primary" />
              <div>
                <h2 className="font-serif text-2xl">Admin Console</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Operational overview for privileged users.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <StatCard label="Donation Records" value={`${safeDonations.length}`} icon={Shield} />
              <StatCard label="Monthly Recurring" value={formatMoney(summary?.monthlyRecurring ?? 0)} icon={Heart} />
              <StatCard label="Total Raised" value={summary ? formatMoney(summary.totalRaised) : "Loading"} icon={BarChart3} />
            </div>

            <div className="bg-background border border-border p-6 space-y-4">
              <h3 className="font-serif text-xl">Admin Notes</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>Review donation records before exporting finance reports.</li>
                <li>Use the member dashboard to validate project follow patterns.</li>
                <li>Keep `ADMIN_USER_IDS` synchronized with your Supabase admin users.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
