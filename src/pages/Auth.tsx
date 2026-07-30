import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CircleCheck,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";

type AuthMode = "login" | "signup" | "recover";
type Notice = { type: "success" | "error"; text: string };

const authSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(6, "Use ao menos 6 caracteres.").optional(),
});

type AuthForm = z.infer<typeof authSchema>;

const modeCopy: Record<
  AuthMode,
  { eyebrow: string; title: string; description: string; submit: string }
> = {
  login: {
    eyebrow: "Bem-vindo de volta",
    title: "Seu bem-estar começa aqui.",
    description:
      "Entre para acompanhar escolhas que fazem sentido para a sua rotina.",
    submit: "Entrar na minha conta",
  },
  signup: {
    eyebrow: "Primeiro passo",
    title: "Crie uma rotina mais leve.",
    description:
      "Leva menos de um minuto para começar a cuidar da sua alimentação.",
    submit: "Criar minha conta",
  },
  recover: {
    eyebrow: "Acontece",
    title: "Vamos recuperar seu acesso.",
    description:
      "Informe seu e-mail e enviaremos as instruções para redefinir sua senha.",
    submit: "Enviar instruções",
  },
};

function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos. Tente novamente.";
    case "auth/email-already-in-use":
      return "Este e-mail já possui uma conta. Faça login para continuar.";
    case "auth/invalid-email":
      return "Confira o e-mail informado e tente novamente.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um momento antes de tentar de novo.";
    case "auth/network-request-failed":
      return "Não foi possível conectar. Verifique sua internet e tente novamente.";
    default:
      return "Não foi possível concluir agora. Tente novamente em instantes.";
  }
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 ${inverse ? "text-white" : "text-[#143c35]"}`}
    >
      <span
        className={`grid size-10 place-items-center rounded-2xl ${inverse ? "bg-white/12 ring-1 ring-white/20" : "bg-[#dff6df] ring-1 ring-[#c4e7cb]"}`}
      >
        <Leaf
          size={21}
          strokeWidth={2.4}
          className={inverse ? "text-[#b8f1c8]" : "text-[#17835c]"}
        />
      </span>
      <span className="text-[1.42rem] font-black leading-none tracking-[-0.07em]">
        nutri
        <span className={inverse ? "text-[#b8f1c8]" : "text-[#17835c]"}>
          pro
        </span>
      </span>
    </div>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#c33d4d]">
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </p>
  );
}

function SetupScreen() {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#f3f7f2] px-4 py-8 sm:px-6">
      <div className="absolute -left-24 top-12 size-72 rounded-full bg-[#d6f3d9] blur-3xl" />
      <div className="absolute -right-16 bottom-0 size-80 rounded-full bg-[#cdeee7] blur-3xl" />
      <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(20,60,53,0.14)] backdrop-blur sm:p-9">
        <Brand />
        <div className="mt-9">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#eff9ef] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-[#27734f]">
            <Sparkles size={14} /> Configuração inicial
          </span>
          <h1 className="mt-4 max-w-md text-3xl font-black leading-tight tracking-[-0.05em] text-[#143c35]">
            Conecte o NutriPro para começar.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#63766f]">
            Faltam apenas as credenciais públicas do Firebase para ativar seu
            espaço pessoal.
          </p>
        </div>
        <ol className="mt-7 space-y-3">
          {[
            "Copie o arquivo .env.example para um novo arquivo .env.",
            "Preencha as variáveis VITE_FIREBASE com os dados do projeto.",
            "Reinicie a aplicação e entre com sua conta.",
          ].map((step, index) => (
            <li
              key={step}
              className="flex gap-3 rounded-2xl border border-[#e4eee5] bg-[#fbfdfb] p-4 text-sm leading-5 text-[#526860]"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#143c35] text-xs font-bold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex items-center gap-2 border-t border-[#e7eeea] pt-5 text-xs font-medium text-[#71827c]">
          <ShieldCheck size={16} className="text-[#17835c]" /> Nenhuma chave
          administrativa é usada no navegador.
        </div>
      </section>
    </main>
  );
}

export function Login({ setup = false }: { setup?: boolean }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    clearErrors,
    setError,
    setValue,
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
  });

  const copy = modeCopy[mode];

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice(null);
    clearErrors();
    setShowPassword(false);
    if (nextMode === "recover") setValue("password", "");
  }

  async function submit(values: AuthForm) {
    const password = values.password ?? "";

    if (mode !== "recover" && !password) {
      setError("password", {
        type: "manual",
        message: "Informe sua senha para continuar.",
      });
      return;
    }

    if (!auth) {
      setNotice({
        type: "error",
        text: "A conexão com sua conta ainda não está configurada.",
      });
      return;
    }

    setNotice(null);

    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, values.email, password);
      } else if (mode === "recover") {
        await sendPasswordResetEmail(auth, values.email);
      } else {
        await signInWithEmailAndPassword(auth, values.email, password);
      }

      if (mode === "recover") {
        setNotice({
          type: "success",
          text: "Pronto! Enviamos as instruções de recuperação para o seu e-mail.",
        });
        return;
      }

      nav(mode === "signup" ? "/onboarding" : "/");
    } catch (error) {
      setNotice({ type: "error", text: getAuthErrorMessage(error) });
    }
  }

  if (setup) return <SetupScreen />;

  return (
    <main className="min-h-[100dvh] bg-[#f3f7f2] p-3 sm:p-5 lg:p-6">
      <div className="relative mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1440px] overflow-hidden rounded-[1.8rem] bg-white shadow-[0_28px_100px_rgba(20,60,53,0.14)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] lg:grid-cols-[1.06fr_0.94fr] lg:rounded-[2.25rem]">
        <aside className="relative hidden overflow-hidden bg-[#123d35] px-10 py-10 text-white lg:flex lg:flex-col xl:px-14 xl:py-12">
          <div className="absolute -left-28 top-24 size-[25rem] rounded-full bg-[#227b5a]/55 blur-3xl" />
          <div className="absolute -right-28 bottom-[-5rem] size-[28rem] rounded-full bg-[#71c998]/30 blur-3xl" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:34px_34px]" />

          <div className="relative z-10 flex items-center justify-between">
            <Brand inverse />
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
              Nutrição sem neura
            </span>
          </div>

          <div className="relative z-10 my-auto max-w-lg py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-[#d9fbe5]">
              <Sparkles size={15} /> Uma rotina que cabe na vida real
            </span>
            <h2 className="mt-6 text-5xl font-black leading-[1.02] tracking-[-0.065em] xl:text-[3.7rem]">
              Alimente seu dia.
              <br />
              <span className="text-[#b8f1c8]">Cuide de você.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/72">
              Registre suas escolhas, acompanhe seus nutrientes e transforme
              pequenas decisões em bem-estar.
            </p>

            <div className="mt-9 max-w-md rounded-[1.55rem] border border-white/15 bg-[#0b2c26]/45 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/55">
                    Seu ritmo hoje
                  </p>
                  <p className="mt-1 text-xl font-bold tracking-[-0.04em]">
                    Equilíbrio em construção
                  </p>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl bg-[#b8f1c8] text-[#123d35]">
                  <TrendingUp size={23} strokeWidth={2.5} />
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full w-[72%] rounded-full bg-[#b8f1c8]" />
              </div>
              <div className="mt-3 flex justify-between text-xs font-medium text-white/65">
                <span>1.680 kcal registradas</span>
                <span>72% da meta</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
                <div>
                  <p className="text-lg font-bold">84g</p>
                  <p className="text-[11px] text-white/55">proteínas</p>
                </div>
                <div>
                  <p className="text-lg font-bold">1,6L</p>
                  <p className="text-[11px] text-white/55">hidratação</p>
                </div>
                <div>
                  <p className="text-lg font-bold">6</p>
                  <p className="text-[11px] text-white/55">registros</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-sm text-white/65">
            <ShieldCheck size={17} className="text-[#b8f1c8]" /> Seus dados
            ficam no seu espaço pessoal.
          </div>
        </aside>

        <section className="relative flex min-h-full items-center justify-center overflow-hidden px-5 py-9 sm:px-10 sm:py-12 lg:px-12 xl:px-20">
          <div className="absolute -right-20 top-0 size-56 rounded-full bg-[#dff5df] blur-3xl lg:hidden" />
          <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-[#d4f1eb] blur-3xl" />
          <div className="relative z-10 w-full max-w-[27rem]">
            <div className="mb-12 lg:hidden">
              <Brand />
              <p className="mt-3 text-sm text-[#71827c]">
                Seu diário alimentar, no seu ritmo.
              </p>
            </div>

            {mode === "recover" && (
              <button
                type="button"
                onClick={() => selectMode("login")}
                className="mb-7 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4a665d] transition hover:text-[#143c35] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17835c]"
              >
                <ChevronLeft size={17} /> Voltar para entrar
              </button>
            )}

            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#eff9ef] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#27734f]">
                <Sparkles size={14} /> {copy.eyebrow}
              </span>
              <h1 className="mt-4 text-[2rem] font-black leading-[1.07] tracking-[-0.055em] text-[#143c35] sm:text-[2.35rem]">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#687b74]">
                {copy.description}
              </p>
            </div>

            <form
              noValidate
              onSubmit={handleSubmit(submit)}
              className="mt-8 space-y-5"
            >
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-sm font-bold text-[#294b41]"
                >
                  E-mail
                </label>
                <div className="group flex items-center gap-3 rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(20,60,53,0.03)] transition focus-within:border-[#278361] focus-within:ring-4 focus-within:ring-[#dff4e5]">
                  <Mail
                    size={19}
                    className="shrink-0 text-[#719087] transition group-focus-within:text-[#17835c]"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#143c35] outline-none placeholder:text-[#a0b0aa]"
                    {...register("email")}
                  />
                </div>
                <FieldError>{errors.email?.message}</FieldError>
              </div>

              {mode !== "recover" && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-bold text-[#294b41]"
                    >
                      Senha
                    </label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => selectMode("recover")}
                        className="text-xs font-bold text-[#17835c] transition hover:text-[#0d5f42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17835c]"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="group flex items-center gap-3 rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(20,60,53,0.03)] transition focus-within:border-[#278361] focus-within:ring-4 focus-within:ring-[#dff4e5]">
                    <LockKeyhole
                      size={19}
                      className="shrink-0 text-[#719087] transition group-focus-within:text-[#17835c]"
                    />
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      placeholder="Sua senha"
                      className="min-w-0 flex-1 bg-transparent text-[15px] text-[#143c35] outline-none placeholder:text-[#a0b0aa]"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showPassword}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-[#789087] transition hover:bg-[#eff7f1] hover:text-[#17835c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17835c]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <FieldError>{errors.password?.message}</FieldError>
                  {mode === "signup" && (
                    <p className="mt-2 text-xs leading-5 text-[#83938e]">
                      Use pelo menos 6 caracteres para proteger sua conta.
                    </p>
                  )}
                </div>
              )}

              {notice && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-5 ${notice.type === "success" ? "border-[#ccebd4] bg-[#effaf1] text-[#226644]" : "border-[#f4d5d9] bg-[#fff6f7] text-[#a63546]"}`}
                >
                  {notice.type === "success" ? (
                    <CircleCheck size={19} className="mt-0.5 shrink-0" />
                  ) : (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-current" />
                  )}
                  <span>{notice.text}</span>
                </div>
              )}

              <button
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#143c35] px-5 py-4 text-sm font-bold text-white shadow-[0_12px_22px_rgba(20,60,53,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0e3029] hover:shadow-[0_16px_28px_rgba(20,60,53,0.25)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17835c]"
              >
                <span>{isSubmitting ? "Só um instante…" : copy.submit}</span>
                {!isSubmitting && (
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                )}
              </button>
            </form>

            {mode !== "recover" && (
              <div className="mt-7 border-t border-[#e5ece7] pt-6 text-center text-sm text-[#71827c]">
                {mode === "login"
                  ? "Ainda não tem uma conta?"
                  : "Já faz parte do NutriPro?"}{" "}
                <button
                  type="button"
                  onClick={() =>
                    selectMode(mode === "login" ? "signup" : "login")
                  }
                  className="font-bold text-[#17835c] underline decoration-[#9dd3aa] decoration-2 underline-offset-4 transition hover:text-[#0d5f42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17835c]"
                >
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </div>
            )}

            <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs leading-5 text-[#8a9a95]">
              <ShieldCheck size={15} className="shrink-0 text-[#4b9b6a]" /> Seus
              dados pessoais permanecem protegidos.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export function Onboarding() {
  const nav = useNavigate();

  return (
    <main className="min-h-[100dvh] bg-[#f3f7f2] p-3 sm:p-5 lg:p-6">
      <div className="relative mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1240px] overflow-hidden rounded-[1.8rem] bg-white shadow-[0_28px_100px_rgba(20,60,53,0.14)] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem] lg:grid-cols-[0.78fr_1.22fr] lg:rounded-[2.25rem]">
        <aside className="relative overflow-hidden bg-[#143c35] px-6 py-7 text-white sm:px-9 lg:px-10 lg:py-11 xl:px-12">
          <div className="absolute -left-20 top-12 size-64 rounded-full bg-[#2b865f]/55 blur-3xl" />
          <div className="absolute -bottom-20 -right-12 size-72 rounded-full bg-[#a8ecbd]/25 blur-3xl" />
          <div className="relative z-10">
            <Brand inverse />
          </div>
          <div className="relative z-10 mt-10 max-w-sm lg:mt-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#d9fbe5]">
              <Sparkles size={14} /> Seu espaço, do seu jeito
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-[-0.06em] lg:text-5xl">
              Vamos definir um ponto de partida.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Com alguns detalhes, o NutriPro consegue tornar suas metas mais
              relevantes para você.
            </p>
          </div>
          <div className="relative z-10 mt-9 grid gap-3 sm:grid-cols-3 lg:mt-14 lg:grid-cols-1">
            {[
              ["1", "Sobre você", "Dados para personalizar sua experiência"],
              ["2", "Suas metas", "Um norte para sua rotina alimentar"],
              ["3", "Começar leve", "Ajuste tudo quando quiser"],
            ].map(([number, title, description], index) => (
              <div
                key={number}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 ${index === 0 ? "border-[#b8f1c8]/50 bg-white/12" : "border-white/10 bg-white/[0.045]"}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-[#b8f1c8] text-[#143c35]" : "bg-white/10 text-white/70"}`}
                >
                  {index === 0 ? <Check size={16} strokeWidth={3} /> : number}
                </span>
                <span>
                  <strong className="block text-sm">{title}</strong>
                  <small className="mt-0.5 block text-xs leading-4 text-white/55">
                    {description}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex items-center px-5 py-9 sm:px-9 sm:py-12 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid size-9 place-items-center rounded-xl bg-[#dff6df] text-[#17835c]">
                <Leaf size={19} />
              </span>
              <span className="text-sm font-bold text-[#27604d]">
                Perfil inicial
              </span>
            </div>
            <div className="mt-7 lg:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#3b9564]">
                Perfil inicial
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.055em] text-[#143c35] sm:text-4xl">
                Conte um pouco sobre você.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#6e817a]">
                Essas informações são apenas uma referência. Você pode
                revisá-las a qualquer momento em seu perfil.
              </p>
            </div>

            <form
              className="mt-8 grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                nav("/");
              }}
            >
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Como podemos chamar você?
                </span>
                <input
                  required
                  autoComplete="name"
                  placeholder="Seu nome"
                  className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 text-[15px] text-[#143c35] outline-none transition placeholder:text-[#a0b0aa] focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Data de nascimento
                </span>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 text-[15px] text-[#143c35] outline-none transition focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Objetivo principal
                </span>
                <select
                  defaultValue="Emagrecimento"
                  className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 text-[15px] text-[#143c35] outline-none transition focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                >
                  <option>Emagrecimento</option>
                  <option>Manutenção</option>
                  <option>Ganho de peso</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Altura{" "}
                  <small className="font-medium text-[#81928c]">(cm)</small>
                </span>
                <input
                  type="number"
                  min="1"
                  inputMode="decimal"
                  placeholder="Ex.: 168"
                  className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 text-[15px] text-[#143c35] outline-none transition placeholder:text-[#a0b0aa] focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Peso atual{" "}
                  <small className="font-medium text-[#81928c]">(kg)</small>
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex.: 65,5"
                  className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 text-[15px] text-[#143c35] outline-none transition placeholder:text-[#a0b0aa] focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-[#294b41]">
                  Meta diária de calorias{" "}
                  <small className="font-medium text-[#81928c]">
                    (estimativa)
                  </small>
                </span>
                <div className="relative">
                  <input
                    defaultValue="2000"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-[#d9e5dc] bg-white px-4 py-3.5 pr-16 text-[15px] text-[#143c35] outline-none transition focus:border-[#278361] focus:ring-4 focus:ring-[#dff4e5]"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-[#82938d]">
                    kcal
                  </span>
                </div>
              </label>
              <div className="sm:col-span-2 mt-1 flex flex-col-reverse gap-4 border-t border-[#e5ece7] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm text-xs leading-5 text-[#83938e]">
                  As estimativas são informativas e não substituem orientação
                  médica ou nutricional.
                </p>
                <button className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#143c35] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_22px_rgba(20,60,53,0.2)] transition hover:-translate-y-0.5 hover:bg-[#0e3029] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#17835c]">
                  <span>Salvar e começar</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
