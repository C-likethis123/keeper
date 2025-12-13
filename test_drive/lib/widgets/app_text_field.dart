import 'package:flutter/material.dart';

enum AppTextFieldVariant {
  /// Standard outlined text field with label
  outlined,

  /// Pill-shaped search field
  search,
}

class AppTextField extends StatefulWidget {
  /// Optional external controller. If not provided, the widget manages its own.
  final TextEditingController? controller;

  /// Initial text value (only used when controller is not provided)
  final String? initialValue;

  final String? hintText;
  final String? labelText;
  final Widget? prefixIcon;
  final AppTextFieldVariant variant;
  final int? maxLines;
  final bool autofocus;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onEditingComplete;
  final TextInputAction? textInputAction;

  const AppTextField({
    super.key,
    this.controller,
    this.initialValue,
    this.hintText,
    this.labelText,
    this.prefixIcon,
    this.variant = AppTextFieldVariant.outlined,
    this.maxLines = 1,
    this.autofocus = false,
    this.onChanged,
    this.onEditingComplete,
    this.textInputAction,
  });

  /// Creates a search-style text field with pill shape
  const AppTextField.search({
    super.key,
    this.controller,
    this.initialValue,
    this.hintText = 'Search',
    this.onChanged,
    this.onEditingComplete,
    this.textInputAction,
  })  : variant = AppTextFieldVariant.search,
        labelText = null,
        prefixIcon = const Icon(Icons.search),
        maxLines = 1,
        autofocus = false;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late final TextEditingController _controller;
  bool _ownsController = false;

  @override
  void initState() {
    super.initState();
    if (widget.controller != null) {
      _controller = widget.controller!;
    } else {
      _controller = TextEditingController(text: widget.initialValue);
      _ownsController = true;
    }
  }

  @override
  void dispose() {
    if (_ownsController) {
      _controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return switch (widget.variant) {
      AppTextFieldVariant.search => _buildSearchField(context),
      AppTextFieldVariant.outlined => _buildOutlinedField(context),
    };
  }

  Widget _buildSearchField(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return TextField(
      controller: _controller,
      onChanged: widget.onChanged,
      onEditingComplete: widget.onEditingComplete,
      textInputAction: widget.textInputAction,
      decoration: InputDecoration(
        hintText: widget.hintText,
        prefixIcon: widget.prefixIcon,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide.none,
        ),
        filled: true,
        fillColor: colorScheme.surface,
        contentPadding: const EdgeInsets.symmetric(vertical: 0),
      ),
    );
  }

  Widget _buildOutlinedField(BuildContext context) {
    return TextField(
      controller: _controller,
      autofocus: widget.autofocus,
      maxLines: widget.maxLines,
      onChanged: widget.onChanged,
      onEditingComplete: widget.onEditingComplete,
      textInputAction: widget.textInputAction,
      decoration: InputDecoration(
        labelText: widget.labelText,
        hintText: widget.hintText,
        prefixIcon: widget.prefixIcon,
        border: const OutlineInputBorder(),
        alignLabelWithHint: widget.maxLines != null && widget.maxLines! > 1,
      ),
    );
  }
}
