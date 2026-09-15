from abc import ABC, abstractmethod

from PIL.Image import Image


class AccidentClassifier(ABC):
    """Decides whether a photo shows a road accident."""

    @property
    @abstractmethod
    def threshold(self) -> float:
        """Score at or above which this model calls a photo an accident.

        Exposed rather than only applied internally so the caller can be more
        or less cautious without the model being retrained.
        """

    @property
    @abstractmethod
    def name(self) -> str:
        """Identifies which model produced a verdict, for logs and debugging."""

    @abstractmethod
    def detect_accident(self, image: Image) -> tuple[float, bool]:
        """Score one image.

        Returns the confidence in [0, 1] and whether it clears the threshold.
        """
