using System;
using System.Collections.Generic;
using System.Globalization;

namespace TechnicallyReal.Promo;

/// <summary>
/// Optional language hook for <see cref="PromotedAppsPage"/>. The page bundles its own
/// strings, so it never depends on a consuming app's localization code.
/// <para>
/// Consumers with their own language setting set <see cref="LocaleProvider"/> once at
/// startup and call <see cref="Refresh"/> whenever their UI language changes. Consumers
/// that do nothing get Windows' preferred languages.
/// </para>
/// </summary>
public static class PromoLocalization
{
    private const string DefaultWording = "en-US";

    /// <summary>
    /// Returns the consumer's current UI locale (a BCP-47 tag such as "fr-CA"), or null to
    /// follow Windows. Unsupported tags fall back to English.
    /// </summary>
    public static Func<string?>? LocaleProvider { get; set; }

    /// <summary>Raised by <see cref="Refresh"/>; open promo pages re-apply their text.</summary>
    public static event Action? Changed;

    /// <summary>Tells open promo pages that the consumer's UI language changed.</summary>
    public static void Refresh() => Changed?.Invoke();

    /// <summary>The wording identity in use: one of the bundled string tables.</summary>
    public static string CurrentWording
    {
        get
        {
            try
            {
                string? locale = LocaleProvider?.Invoke();
                if (!string.IsNullOrWhiteSpace(locale))
                {
                    return ResolveWording(new[] { locale! });
                }
            }
            catch { /* a broken hook must never break the promo page */ }

            return ResolveWording(WindowsPreferredLanguages());
        }
    }

    /// <summary>Returns the bundled translation of an English string, or the English itself.</summary>
    public static string Get(string english)
    {
        if (Strings.TryGetValue(CurrentWording, out var table) &&
            table.TryGetValue(english, out var text))
        {
            return text;
        }

        return english;
    }

    /// <summary>
    /// Maps preferences to a bundled wording. Canadian locales reuse en-US / fr-FR wording;
    /// Traditional Chinese never selects Simplified Chinese.
    /// </summary>
    internal static string ResolveWording(IEnumerable<string> preferences)
    {
        foreach (string preference in preferences)
        {
            if (string.IsNullOrWhiteSpace(preference))
            {
                continue;
            }

            string[] parts = preference.Trim().Replace('_', '-').Split('-');
            switch (parts[0].ToLowerInvariant())
            {
                case "en": return "en-US";
                case "es": return "es-ES";
                case "fr": return "fr-FR";
                case "de": return "de-DE";
                case "pt": return "pt-BR";
                case "ja": return "ja-JP";
                case "zh":
                    if (IsSimplifiedChinese(parts))
                    {
                        return "zh-CN";
                    }

                    break;
            }
        }

        return DefaultWording;
    }

    private static bool IsSimplifiedChinese(string[] parts)
    {
        for (int i = 1; i < parts.Length; i++)
        {
            string part = parts[i];
            if (part.Length == 1)
            {
                break; // extensions (-u-, -x-) are not wording identity
            }

            if (part.Length == 4)
            {
                return part.Equals("Hans", StringComparison.OrdinalIgnoreCase);
            }

            if (part.Equals("TW", StringComparison.OrdinalIgnoreCase) ||
                part.Equals("HK", StringComparison.OrdinalIgnoreCase) ||
                part.Equals("MO", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }
        return true;
    }

    private static IEnumerable<string> WindowsPreferredLanguages()
    {
        IReadOnlyList<string>? languages = null;
        try { languages = global::Windows.System.UserProfile.GlobalizationPreferences.Languages; }
        catch { /* fall back to the process UI culture */ }

        if (languages is { Count: > 0 })
        {
            return languages;
        }

        return new[] { CultureInfo.CurrentUICulture.Name };
    }

    // Keyed by the English text. Keep every table in sync when adding a string.
    private static readonly Dictionary<string, Dictionary<string, string>> Strings = new(StringComparer.OrdinalIgnoreCase)
    {
        ["es-ES"] = new()
        {
            ["Our other apps"] = "Nuestras otras aplicaciones",
            ["More apps from Dynamic Solutions (CA)."] = "Más aplicaciones de Dynamic Solutions (CA).",
            ["View in Store"] = "Ver en Store",
            ["Visit website"] = "Visitar sitio web",
            ["Open"] = "Abrir",
        },
        ["fr-FR"] = new()
        {
            ["Our other apps"] = "Nos autres applications",
            ["More apps from Dynamic Solutions (CA)."] = "Plus d’applications de Dynamic Solutions (CA).",
            ["View in Store"] = "Voir dans le Store",
            ["Visit website"] = "Visiter le site web",
            ["Open"] = "Ouvrir",
        },
        ["de-DE"] = new()
        {
            ["Our other apps"] = "Unsere anderen Apps",
            ["More apps from Dynamic Solutions (CA)."] = "Weitere Apps von Dynamic Solutions (CA).",
            ["View in Store"] = "Im Store ansehen",
            ["Visit website"] = "Website besuchen",
            ["Open"] = "Öffnen",
        },
        ["zh-CN"] = new()
        {
            ["Our other apps"] = "我们的其他应用",
            ["More apps from Dynamic Solutions (CA)."] = "Dynamic Solutions (CA) 的更多应用。",
            ["View in Store"] = "在应用商店中查看",
            ["Visit website"] = "访问网站",
            ["Open"] = "打开",
        },
        ["pt-BR"] = new()
        {
            ["Our other apps"] = "Nossos outros aplicativos",
            ["More apps from Dynamic Solutions (CA)."] = "Mais aplicativos da Dynamic Solutions (CA).",
            ["View in Store"] = "Ver na Store",
            ["Visit website"] = "Visitar site",
            ["Open"] = "Abrir",
        },
        ["ja-JP"] = new()
        {
            ["Our other apps"] = "その他のアプリ",
            ["More apps from Dynamic Solutions (CA)."] = "Dynamic Solutions (CA) のその他のアプリ。",
            ["View in Store"] = "ストアで表示",
            ["Visit website"] = "Web サイトにアクセス",
            ["Open"] = "開く",
        },
    };
}
