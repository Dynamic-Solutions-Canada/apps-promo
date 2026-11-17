using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using Windows.Foundation;

namespace TechnicallyReal.Promo;

/// <summary>
/// Lays out a leading element, a content element and a trailing action, in that child order.
/// When the content still gets at least <see cref="MinContentWidth"/>, the action sits to the
/// right of the content; otherwise it moves under the content, left-aligned with it, so narrow
/// layouts never squeeze the content into a few characters per line.
/// </summary>
/// <remarks>
/// The decision uses the panel's own width, not the window's: a page's width also depends on the
/// host's navigation pane, and the action's width depends on its localized label, so no fixed
/// window breakpoint fits every host and language. The leading element and the action keep their
/// natural sizes and are centred vertically, as a three-column Grid with Auto, * and Auto would.
/// Children past the third are ignored.
/// </remarks>
public sealed class TrailingActionPanel : Panel
{
    /// <summary>The gap between columns, and between the content and the action when stacked.</summary>
    public static readonly DependencyProperty SpacingProperty = DependencyProperty.Register(
        nameof(Spacing), typeof(double), typeof(TrailingActionPanel),
        new PropertyMetadata(0d, OnLayoutPropertyChanged));

    /// <summary>The narrowest the content may get before the action moves under it.</summary>
    public static readonly DependencyProperty MinContentWidthProperty = DependencyProperty.Register(
        nameof(MinContentWidth), typeof(double), typeof(TrailingActionPanel),
        new PropertyMetadata(0d, OnLayoutPropertyChanged));

    /// <inheritdoc cref="SpacingProperty"/>
    public double Spacing
    {
        get => (double)GetValue(SpacingProperty);
        set => SetValue(SpacingProperty, value);
    }

    /// <inheritdoc cref="MinContentWidthProperty"/>
    public double MinContentWidth
    {
        get => (double)GetValue(MinContentWidthProperty);
        set => SetValue(MinContentWidthProperty, value);
    }

    /// <summary>Whether the last measure put the action under the content.</summary>
    private bool _actionBelow;

    /// <summary>Re-measures when a layout property changes after the panel is shown.</summary>
    private static void OnLayoutPropertyChanged(DependencyObject sender, DependencyPropertyChangedEventArgs e)
    {
        ((TrailingActionPanel)sender).InvalidateMeasure();
    }

    /// <summary>
    /// Measures the leading element and the action at their natural sizes, chooses the arrangement
    /// from the width left for the content, and measures the content at that width.
    /// </summary>
    protected override Size MeasureOverride(Size availableSize)
    {
        UIElement? leading = ChildAt(0);
        UIElement? content = ChildAt(1);
        UIElement? action = ChildAt(2);

        Size natural = new(double.PositiveInfinity, double.PositiveInfinity);
        leading?.Measure(natural);
        action?.Measure(natural);

        Size leadingSize = leading?.DesiredSize ?? default;
        Size actionSize = action?.DesiredSize ?? default;
        double leadingSpan = leading is null ? 0 : leadingSize.Width + Spacing;
        double actionSpan = action is null ? 0 : actionSize.Width + Spacing;

        // An unbounded width (a horizontally scrolling host) always has room beside the content.
        double width = availableSize.Width;
        double besideWidth = width - leadingSpan - actionSpan;
        _actionBelow = action is not null
            && !double.IsInfinity(width)
            && besideWidth < MinContentWidth;

        double contentWidth = _actionBelow ? width - leadingSpan : besideWidth;
        content?.Measure(new Size(Math.Max(0, contentWidth), double.PositiveInfinity));
        Size contentSize = content?.DesiredSize ?? default;

        // Stacked: the content and the action share the column after the leading element.
        if (_actionBelow)
        {
            double columnWidth = Math.Max(contentSize.Width, actionSize.Width);
            double columnHeight = contentSize.Height + Spacing + actionSize.Height;
            return new Size(
                leadingSpan + columnWidth,
                Math.Max(leadingSize.Height, columnHeight));
        }

        return new Size(
            leadingSpan + contentSize.Width + actionSpan,
            Math.Max(leadingSize.Height, Math.Max(contentSize.Height, actionSize.Height)));
    }

    /// <summary>Places the children in the arrangement the last measure chose.</summary>
    protected override Size ArrangeOverride(Size finalSize)
    {
        UIElement? leading = ChildAt(0);
        UIElement? content = ChildAt(1);
        UIElement? action = ChildAt(2);

        Size leadingSize = leading?.DesiredSize ?? default;
        Size contentSize = content?.DesiredSize ?? default;
        Size actionSize = action?.DesiredSize ?? default;
        double contentLeft = leading is null ? 0 : leadingSize.Width + Spacing;
        double contentWidth;

        // The leading element is centred against the whole height in both arrangements.
        leading?.Arrange(new Rect(0, CentredTop(finalSize.Height, leadingSize.Height), leadingSize.Width, leadingSize.Height));

        if (_actionBelow)
        {
            double columnHeight = contentSize.Height + Spacing + actionSize.Height;
            double top = CentredTop(finalSize.Height, columnHeight);
            contentWidth = Math.Max(0, finalSize.Width - contentLeft);

            content?.Arrange(new Rect(contentLeft, top, contentWidth, contentSize.Height));
            action?.Arrange(new Rect(contentLeft, top + contentSize.Height + Spacing, actionSize.Width, actionSize.Height));
            return finalSize;
        }

        // Beside: the content takes the width the leading element and the action leave.
        double actionSpan = action is null ? 0 : actionSize.Width + Spacing;
        contentWidth = Math.Max(0, finalSize.Width - contentLeft - actionSpan);

        content?.Arrange(new Rect(contentLeft, CentredTop(finalSize.Height, contentSize.Height), contentWidth, contentSize.Height));
        action?.Arrange(new Rect(finalSize.Width - actionSize.Width, CentredTop(finalSize.Height, actionSize.Height), actionSize.Width, actionSize.Height));
        return finalSize;
    }

    /// <summary>The child at <paramref name="index"/>, or null when there are fewer children.</summary>
    private UIElement? ChildAt(int index)
    {
        return index < Children.Count ? Children[index] : null;
    }

    /// <summary>The top offset that centres a height of <paramref name="height"/> within <paramref name="available"/>.</summary>
    private static double CentredTop(double available, double height)
    {
        return Math.Max(0, (available - height) / 2);
    }
}
