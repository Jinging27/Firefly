export type RedirectStatus = 301;

export type RedirectRule = {
	readonly status: RedirectStatus;
	readonly destination: string;
};

export type RedirectsConfig = Readonly<Record<string, RedirectRule>>;
