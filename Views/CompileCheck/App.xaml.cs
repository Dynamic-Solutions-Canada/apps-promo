using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace TechnicallyReal.Promo.CompileCheck;

/// <summary>
/// Uses the shared page the way an app does, so a change that breaks a consumer's build fails here
/// first. Never run.
/// </summary>
public partial class App : Application
{
    /// <summary>Create the app.</summary>
    public App() => InitializeComponent();

    /// <summary>Point the page at a language source and navigate to it, as an app's settings window does.</summary>
    /// <param name="args">Launch details.</param>
    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        PromoLocalization.LocaleProvider = static () => "en-US";

        var frame = new Frame();
        frame.Navigate(typeof(PromotedAppsPage));
        PromoLocalization.Refresh();

        var window = new Window { Content = frame };
        window.Activate();
    }
}
