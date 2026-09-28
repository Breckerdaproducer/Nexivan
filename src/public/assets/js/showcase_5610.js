(function ($) {
    "use strict";

    var pxl_widget_showcase_handler = function ($scope, $) {
        // Handle both showcase1 and showcase2
        const showcaseImages = $scope.find('.pxl-showcase1 .pxl-item--image, .pxl-showcase2 .pxl-item--image');

        showcaseImages.each(function() {
            const container = $(this);
            const img = container.find('img');
            if (!img.length) return;

            let isScrolling = false;
            let targetScroll = 0;
            let currentScroll = 0;
            let animationFrame;

            function updateScroll() {
                if (Math.abs(targetScroll - currentScroll) < 0.5) {
                    currentScroll = targetScroll;
                    img.css('transform', `translateY(-${currentScroll}px)`);
                    isScrolling = false;
                    return;
                }

                currentScroll += (targetScroll - currentScroll) * 0.03;
                img.css('transform', `translateY(-${currentScroll}px)`);
                animationFrame = requestAnimationFrame(updateScroll);
            }

            function startScrollAnimation() {
                if (!isScrolling) {
                    isScrolling = true;
                    animationFrame = requestAnimationFrame(updateScroll);
                }
            }

            container.on('mouseenter', function() {
                const maxScroll = img[0].offsetHeight - container.height();
                targetScroll = maxScroll;
                startScrollAnimation();
            });

            container.on('mouseleave', function() {
                targetScroll = 0;
                startScrollAnimation();
            });

            // Cleanup on element removal
            container.on('remove', function() {
                cancelAnimationFrame(animationFrame);
            });
        });
    };

    $(window).on('elementor/frontend/init', function() {
        elementorFrontend.hooks.addAction('frontend/element_ready/pxl_showcase.default', pxl_widget_showcase_handler);
    });
})(jQuery);
