from .model import AccidentClassifier

__all__ = ["AccidentClassifier", "ClipLinearProbe"]


def __getattr__(name: str):
    """Defer the torch import until a concrete model is actually asked for."""
    if name == "ClipLinearProbe":
        from .clip_probe import ClipLinearProbe

        return ClipLinearProbe

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
