const styles = {
    // Base layout & Theme
    boxWidth: "xl:max-w-[1280px] w-full",
    // Core Nebula Theme
    glassCard: "bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl relative group",
    glassCardGlow: "absolute inset-0 bg-gradient-to-r from-orange-600/0 via-amber-500/0 to-orange-600/0 group-hover:from-orange-600/20 group-hover:via-amber-500/10 group-hover:to-orange-600/20 blur-2xl transition-all duration-500 rounded-2xl -z-10",
    heading2: "font-poppins font-semibold xs:text-[48px] text-[40px] text-white xs:leading-[76.8px] leading-[66.8px] w-full",
    paragraph: "font-poppins font-normal text-white/70 text-[18px] leading-[30.8px]",
    flexCenter: "flex justify-center items-center",
    flexStart: "flex justify-center items-start",
    paddingX: "sm:px-16 px-6",
    paddingY: "sm:py-16 py-6",
    padding: "sm:px-16 px-6 sm:py-12 py-4",
    marginX: "sm:mx-16 mx-6",
    marginY: "sm:my-16 my-6",
};
export const layout = {
    section: `flex md:flex-row flex-col ${styles.paddingY}`,
    sectionReverse: `flex md:flex-row flex-col-reverse ${styles.paddingY}`,
    sectionImgReverse: `flex-1 flex ${styles.flexCenter} md:mr-10 mr-0 md:mt-0 mt-10 relative`,
    sectionImg: `flex-1 flex ${styles.flexCenter} md:ml-10 ml-0 md:mt-0 mt-10 relative`,
    sectionInfo: `flex-1 ${styles.flexStart} flex-col`,
};
export default styles;