import { redirect } from "next/navigation";
import { isAuthenticated } from "../../lib/auth";
import LogoMark from "../components/atoms/LogoMark/LogoMark";
import styles from "../page.module.css";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className={styles.main}>
      <div className={styles.loginCard}>
      <LogoMark className={styles.logo} />
      <h1 className={styles.title}>BJJ Log</h1>
      <p className={styles.tagline}>Your private training journal</p>
      <form action="/api/login" method="post" className={styles.login}>
        <label htmlFor="password">Your private journal password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
        {error && <p role="alert">That password didn’t match. Try again.</p>}
        <button type="submit">Sign in</button>
      </form>
      </div>
    </main>
  );
}
