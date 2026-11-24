interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}

export default function BrandLogo({ size = 'md', subtitle }: BrandLogoProps) {
  const imgSize =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const textSize =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.png"
        alt="TicketDrop AI"
        className={`${imgSize} shrink-0 rounded-xl shadow-md shadow-[#FF3366]/20 ring-1 ring-white/10`}
      />
      <div>
        <div className={`${textSize} leading-tight font-extrabold tracking-tight text-zinc-900 dark:text-white`}>
          TicketDrop <span className="text-[#FF3366]">AI</span>
        </div>
        {subtitle && (
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

